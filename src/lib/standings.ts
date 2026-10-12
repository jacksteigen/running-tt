import { parsePrizes, prizeToCents } from "@/lib/racetime";

// Standings: overall ranks, age group ranks and prize money for an event,
// always rebuilt from the results table so they can never drift.

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
export async function recompute(db: D1Database, eventId: string): Promise<Standing[]> {
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


/** Re-rank every event this athlete has a result in, e.g. after a DOB fix. */
export async function recomputeForAthlete(db: D1Database, userId: string) {
  const events = (await db
    .prepare("SELECT DISTINCT event_id FROM results WHERE user_id = ?")
    .bind(userId)
    .all()) as unknown as { results: { event_id: string }[] };
  for (const e of events.results) await recompute(db, e.event_id);
}
