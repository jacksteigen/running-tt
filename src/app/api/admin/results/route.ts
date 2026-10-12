import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { getSession, generateId } from "@/lib/auth";
import {
  parseTimeToSeconds,
  formatSeconds,
  stopwatchReading,
  LONG_TIME_SECONDS,
} from "@/lib/racetime";
import { recomputePersonalBest } from "@/lib/personalBests";
import { recompute } from "@/lib/standings";
import { isOutcome, type Outcome } from "@/lib/outcomes";

async function listOutcomes(db: D1Database, eventId: string) {
  const rows = (await db
    .prepare(
      "SELECT user_id, outcome FROM entries WHERE event_id = ? AND outcome IS NOT NULL"
    )
    .bind(eventId)
    .all()) as unknown as { results: { user_id: string; outcome: Outcome }[] };
  return rows.results.map((r) => ({ userId: r.user_id, outcome: r.outcome }));
}

async function requireAdmin(db: D1Database) {
  const session = await getSession(db);
  if (!session) return { error: "Not authenticated", status: 401 };
  if (!session.user.isAdmin) return { error: "Not permitted", status: 403 };
  return { session };
}

/** Save (or replace) one athlete's time for an event. */
export async function POST(request: NextRequest) {
  const db = await getDB();
  const auth = await requireAdmin(db);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let eventId = "";
  let userId = "";
  let time = "";
  let heat: number | null = null;
  let confirmLong = false;
  let outcome: Outcome | null = null;
  try {
    const body = (await request.json()) as {
      eventId?: string;
      userId?: string;
      time?: string;
      heat?: number | string;
      confirmLong?: boolean;
      outcome?: string;
    };
    outcome = isOutcome(body.outcome) ? body.outcome : null;
    eventId = typeof body.eventId === "string" ? body.eventId : "";
    userId = typeof body.userId === "string" ? body.userId : "";
    time = typeof body.time === "string" ? body.time.trim() : "";
    const h = Number(body.heat);
    heat = Number.isInteger(h) && h > 0 && h < 1000 ? h : null;
    confirmLong = body.confirmLong === true;
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  // DNF, DNS or DQ: mark the entry and remove any time, then re-rank.
  if (outcome) {
    const ev = await db
      .prepare("SELECT id, distance FROM events WHERE id = ?")
      .bind(eventId)
      .first<{ id: string; distance: string }>();
    if (!ev) return NextResponse.json({ error: "Event not found" }, { status: 404 });

    const marked = await db
      .prepare(
        "UPDATE entries SET outcome = ? WHERE event_id = ? AND user_id = ? AND status = 'confirmed'"
      )
      .bind(outcome, eventId, userId)
      .run();
    if (!(marked.meta.changes ?? 0)) {
      return NextResponse.json(
        { error: "That athlete is not entered in this event" },
        { status: 400 }
      );
    }

    await db
      .prepare("DELETE FROM results WHERE event_id = ? AND user_id = ?")
      .bind(eventId, userId)
      .run();
    await recomputePersonalBest(db, userId, ev.distance);

    const standings = await recompute(db, eventId);
    return NextResponse.json({ success: true, standings, outcomes: await listOutcomes(db, eventId) });
  }

  const seconds = parseTimeToSeconds(time);
  if (seconds === null) {
    return NextResponse.json(
      { error: `"${time}" is not a time I can read. Try 4:32.10` },
      { status: 400 }
    );
  }

  // Over an hour is almost always a stopwatch reading typed with colons.
  if (seconds > LONG_TIME_SECONDS && !confirmLong) {
    const suggestion = stopwatchReading(time);
    return NextResponse.json(
      {
        code: "LONG_TIME",
        error: `"${time}" reads as ${formatSeconds(seconds)}, over an hour.${
          suggestion ? ` Did you mean ${suggestion.display}?` : ""
        }`,
        suggestion: suggestion?.display ?? null,
      },
      { status: 422 }
    );
  }

  const event = await db
    .prepare("SELECT id, distance FROM events WHERE id = ?")
    .bind(eventId)
    .first<{ id: string; distance: string }>();
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const entry = await db
    .prepare(
      "SELECT id, age_group, heat_number FROM entries WHERE event_id = ? AND user_id = ? AND status = 'confirmed'"
    )
    .bind(eventId, userId)
    .first<{ id: string; age_group: string | null; heat_number: number | null }>();
  if (!entry) {
    return NextResponse.json(
      { error: "That athlete is not entered in this event" },
      { status: 400 }
    );
  }

  const display = formatSeconds(seconds);

  await db
    .prepare("DELETE FROM results WHERE event_id = ? AND user_id = ?")
    .bind(eventId, userId)
    .run();

  await db
    .prepare(
      `INSERT INTO results
         (id, event_id, user_id, entry_id, time_seconds, time_display, heat_number, verified, age_group)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`
    )
    .bind(
      `res_${generateId()}`,
      eventId,
      userId,
      entry.id,
      seconds,
      display,
      heat ?? entry.heat_number ?? 1,
      entry.age_group
    )
    .run();

  await db
    .prepare("UPDATE entries SET outcome = NULL WHERE id = ?")
    .bind(entry.id)
    .run();

  await recomputePersonalBest(db, userId, event.distance);

  const standings = await recompute(db, eventId);
  return NextResponse.json({ success: true, standings, outcomes: await listOutcomes(db, eventId) });
}

/** Remove one athlete's time for an event. */
export async function DELETE(request: NextRequest) {
  const db = await getDB();
  const auth = await requireAdmin(db);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let eventId = "";
  let userId = "";
  try {
    const body = (await request.json()) as { eventId?: string; userId?: string };
    eventId = typeof body.eventId === "string" ? body.eventId : "";
    userId = typeof body.userId === "string" ? body.userId : "";
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  await db
    .prepare("DELETE FROM results WHERE event_id = ? AND user_id = ?")
    .bind(eventId, userId)
    .run();

  const event = await db
    .prepare("SELECT distance FROM events WHERE id = ?")
    .bind(eventId)
    .first<{ distance: string }>();
  if (event) await recomputePersonalBest(db, userId, event.distance);

  await db
    .prepare("UPDATE entries SET outcome = NULL WHERE event_id = ? AND user_id = ?")
    .bind(eventId, userId)
    .run();

  const standings = await recompute(db, eventId);
  return NextResponse.json({ success: true, standings, outcomes: await listOutcomes(db, eventId) });
}
