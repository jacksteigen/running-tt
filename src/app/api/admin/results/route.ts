import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { getSession, generateId } from "@/lib/auth";
import {
  parseTimeToSeconds,
  formatSeconds,
  parsePrizes,
  prizeToCents,
} from "@/lib/racetime";

interface ResultInput {
  userId: string;
  time: string;
}

export async function POST(request: NextRequest) {
  const db = await getDB();
  const session = await getSession(db);

  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (!session.user.isAdmin) {
    return NextResponse.json({ error: "Not permitted" }, { status: 403 });
  }

  let eventId = "";
  let rows: ResultInput[] = [];
  try {
    const body = (await request.json()) as {
      eventId?: string;
      rows?: ResultInput[];
    };
    eventId = typeof body.eventId === "string" ? body.eventId : "";
    rows = Array.isArray(body.rows) ? body.rows.slice(0, 500) : [];
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const event = await db
    .prepare("SELECT id, distance, prizes FROM events WHERE id = ?")
    .bind(eventId)
    .first<{ id: string; distance: string; prizes: string | null }>();

  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  // Only athletes with a confirmed entry can be given a result.
  const entrants = await db
    .prepare(
      "SELECT user_id, id as entry_id FROM entries WHERE event_id = ? AND status = 'confirmed'"
    )
    .bind(eventId)
    .all() as unknown as {
    results: { user_id: string; entry_id: string }[];
  };

  const entryByUser = new Map(
    entrants.results.map((e) => [e.user_id, e.entry_id])
  );

  const parsed: { userId: string; seconds: number; entryId: string }[] = [];
  for (const row of rows) {
    if (!row || typeof row.userId !== "string") continue;
    const entryId = entryByUser.get(row.userId);
    if (!entryId) continue;

    const raw = typeof row.time === "string" ? row.time.trim() : "";
    if (!raw) continue;

    const seconds = parseTimeToSeconds(raw);
    if (seconds === null) {
      return NextResponse.json(
        { error: `"${raw}" is not a time I can read. Try 4:32.10` },
        { status: 400 }
      );
    }
    parsed.push({ userId: row.userId, seconds, entryId });
  }

  parsed.sort((a, b) => a.seconds - b.seconds);

  const prizes = parsePrizes(event.prizes);

  // Rewrite this event's results so removed times do not linger.
  await db.prepare("DELETE FROM results WHERE event_id = ?").bind(eventId).run();

  for (let i = 0; i < parsed.length; i++) {
    const { userId, seconds, entryId } = parsed[i];
    const display = formatSeconds(seconds);
    const rank = i + 1;
    const prizeCents = prizes[i] ? prizeToCents(prizes[i].amount) : 0;

    await db
      .prepare(
        `INSERT INTO results
           (id, event_id, user_id, entry_id, time_seconds, time_display, heat_number, rank, verified, prize_amount_cents)
         VALUES (?, ?, ?, ?, ?, ?, 1, ?, 1, ?)`
      )
      .bind(
        `res_${generateId()}`,
        eventId,
        userId,
        entryId,
        seconds,
        display,
        rank,
        prizeCents
      )
      .run();

    // Keep the athlete's personal best for this distance current.
    const existing = await db
      .prepare(
        "SELECT id, time_seconds FROM personal_bests WHERE user_id = ? AND distance = ?"
      )
      .bind(userId, event.distance)
      .first<{ id: string; time_seconds: number }>();

    if (!existing) {
      await db
        .prepare(
          `INSERT INTO personal_bests
             (id, user_id, distance, time_seconds, time_display, event_id, verified)
           VALUES (?, ?, ?, ?, ?, ?, 1)`
        )
        .bind(
          `pb_${generateId()}`,
          userId,
          event.distance,
          seconds,
          display,
          eventId
        )
        .run();
    } else if (seconds < existing.time_seconds) {
      await db
        .prepare(
          "UPDATE personal_bests SET time_seconds = ?, time_display = ?, event_id = ?, verified = 1 WHERE id = ?"
        )
        .bind(seconds, display, eventId, existing.id)
        .run();
    }
  }

  return NextResponse.json({ success: true, saved: parsed.length });
}
