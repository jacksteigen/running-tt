import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { getSession, generateId } from "@/lib/auth";
import {
  parseTimeToSeconds,
  formatSeconds,
  parsePrizes,
  prizeToCents,
} from "@/lib/racetime";

export interface Standing {
  userId: string;
  rank: number;
  ageGroup: string | null;
  ageGroupRank: number | null;
  timeDisplay: string;
  heat: number;
  prizeCents: number;
}

/**
 * Re-rank every result for an event: overall by time, then within each age
 * group, with prize money assigned down the overall order. Runs after every
 * single save so the public leaderboard is always consistent.
 */
async function recompute(db: D1Database, eventId: string): Promise<Standing[]> {
  const event = await db
    .prepare("SELECT prizes FROM events WHERE id = ?")
    .bind(eventId)
    .first<{ prizes: string | null }>();
  const prizes = parsePrizes(event?.prizes ?? null);

  const rows = await db
    .prepare(
      `SELECT r.id, r.user_id, r.time_seconds, r.time_display, r.heat_number, e.age_group
       FROM results r
       LEFT JOIN entries e ON e.event_id = r.event_id AND e.user_id = r.user_id
       WHERE r.event_id = ?
       ORDER BY r.time_seconds ASC`
    )
    .bind(eventId)
    .all() as unknown as {
    results: {
      id: string;
      user_id: string;
      time_seconds: number;
      time_display: string;
      heat_number: number;
      age_group: string | null;
    }[];
  };

  const groupCounts = new Map<string, number>();
  const standings: Standing[] = [];

  for (let i = 0; i < rows.results.length; i++) {
    const row = rows.results[i];
    const rank = i + 1;
    let ageGroupRank: number | null = null;
    if (row.age_group) {
      const n = (groupCounts.get(row.age_group) ?? 0) + 1;
      groupCounts.set(row.age_group, n);
      ageGroupRank = n;
    }
    const prizeCents = prizes[i] ? prizeToCents(prizes[i].amount) : 0;

    await db
      .prepare(
        "UPDATE results SET rank = ?, age_group = ?, age_group_rank = ?, prize_amount_cents = ? WHERE id = ?"
      )
      .bind(rank, row.age_group, ageGroupRank, prizeCents, row.id)
      .run();

    standings.push({
      userId: row.user_id,
      rank,
      ageGroup: row.age_group,
      ageGroupRank,
      timeDisplay: row.time_display,
      heat: row.heat_number,
      prizeCents,
    });
  }

  return standings;
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
  let heat = 1;
  try {
    const body = (await request.json()) as {
      eventId?: string;
      userId?: string;
      time?: string;
      heat?: number | string;
    };
    eventId = typeof body.eventId === "string" ? body.eventId : "";
    userId = typeof body.userId === "string" ? body.userId : "";
    time = typeof body.time === "string" ? body.time.trim() : "";
    const h = Number(body.heat);
    heat = Number.isInteger(h) && h > 0 && h < 1000 ? h : 1;
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const seconds = parseTimeToSeconds(time);
  if (seconds === null) {
    return NextResponse.json(
      { error: `"${time}" is not a time I can read. Try 4:32.10` },
      { status: 400 }
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
      "SELECT id, age_group FROM entries WHERE event_id = ? AND user_id = ? AND status = 'confirmed'"
    )
    .bind(eventId, userId)
    .first<{ id: string; age_group: string | null }>();
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
      heat,
      entry.age_group
    )
    .run();

  // Personal best for this distance.
  const pb = await db
    .prepare(
      "SELECT id, time_seconds FROM personal_bests WHERE user_id = ? AND distance = ?"
    )
    .bind(userId, event.distance)
    .first<{ id: string; time_seconds: number }>();

  if (!pb) {
    await db
      .prepare(
        `INSERT INTO personal_bests (id, user_id, distance, time_seconds, time_display, event_id, verified)
         VALUES (?, ?, ?, ?, ?, ?, 1)`
      )
      .bind(`pb_${generateId()}`, userId, event.distance, seconds, display, eventId)
      .run();
  } else if (seconds < pb.time_seconds) {
    await db
      .prepare(
        "UPDATE personal_bests SET time_seconds = ?, time_display = ?, event_id = ?, verified = 1 WHERE id = ?"
      )
      .bind(seconds, display, eventId, pb.id)
      .run();
  }

  const standings = await recompute(db, eventId);
  return NextResponse.json({ success: true, standings });
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

  const standings = await recompute(db, eventId);
  return NextResponse.json({ success: true, standings });
}
