import { parsePrizes, prizeToCents } from "@/lib/racetime";
import { toPrizeSplit, toRaceCategory, type RaceCategory } from "@/lib/categories";

// Standings: overall ranks, category places, age group ranks, prize money and
// age group awards for an event, always rebuilt from the results table so
// they can never drift.

export interface Standing {
  userId: string;
  rank: number;
  ageGroup: string | null;
  ageGroupRank: number | null;
  timeDisplay: string;
  heat: number;
  prizeCents: number;
  /** The athlete's category when the standings were built, if they had one. */
  raceCategory: RaceCategory | null;
  /** Place among the athlete's category, or null without a category. */
  categoryRank: number | null;
  /** Fastest in their age group without a prize place, when the event gives one. */
  ageGroupAward: boolean;
}

/**
 * Re-rank every result for an event and work out who wins what. Runs after
 * every single save so the public leaderboard is always consistent.
 *
 * Overall rank is by time. An event that pays overall gives prize slot i to
 * overall place i+1, and ranks age groups across the whole field. An event
 * that pays per category gives prize slot i to place i+1 in each category,
 * and ranks age groups within each category; athletes with no category get
 * no category place, no prize and no age group place.
 *
 * The age group award, when the event offers one, goes to the fastest
 * athlete in each age group who did not take a prize place (cash or not).
 *
 * The category a result counts in is a snapshot. Once a result has one it
 * stays, so an athlete changing their profile later cannot move places or
 * prize money in a race already run. A result with no category yet takes the
 * athlete's current one. Only an admin changes a snapshot, on purpose, from
 * the athlete editor.
 */
export async function recompute(db: D1Database, eventId: string): Promise<Standing[]> {
  const event = await db
    .prepare("SELECT prizes, prize_split, age_group_prize FROM events WHERE id = ?")
    .bind(eventId)
    .first<{ prizes: string | null; prize_split: string | null; age_group_prize: string | null }>();
  const prizes = parsePrizes(event?.prizes ?? null);
  const split = toPrizeSplit(event?.prize_split);
  const offersAward = !!event?.age_group_prize?.trim();

  const rows = await db
    .prepare(
      `SELECT r.id, r.user_id, r.time_seconds, r.time_display, r.heat_number, e.age_group,
              COALESCE(r.race_category, u.race_category) AS race_category
       FROM results r
       LEFT JOIN entries e ON e.event_id = r.event_id AND e.user_id = r.user_id
       LEFT JOIN users u ON u.id = r.user_id
       WHERE r.event_id = ?
       ORDER BY r.time_seconds ASC, r.created_at ASC, r.id ASC`
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
      race_category: string | null;
    }[];
  };

  const categoryCounts = new Map<RaceCategory, number>();
  const groupCounts = new Map<string, number>();
  // Age groups whose award has been given. Rows arrive fastest first, so the
  // first athlete in a group without a prize place is the one who wins it.
  const awarded = new Set<string>();
  const standings: Standing[] = [];
  const update = db.prepare(
    `UPDATE results SET rank = ?, age_group = ?, age_group_rank = ?, prize_amount_cents = ?,
       race_category = ?, category_rank = ?, age_group_award = ?
     WHERE id = ?`
  );
  const updates: D1PreparedStatement[] = [];

  for (let i = 0; i < rows.results.length; i++) {
    const row = rows.results[i];
    const rank = i + 1;
    const raceCategory = toRaceCategory(row.race_category);

    let categoryRank: number | null = null;
    if (raceCategory) {
      categoryRank = (categoryCounts.get(raceCategory) ?? 0) + 1;
      categoryCounts.set(raceCategory, categoryRank);
    }

    // Who an athlete is ranked against for age group places and awards.
    const groupKey =
      split === "category"
        ? raceCategory && row.age_group
          ? `${raceCategory}|${row.age_group}`
          : null
        : row.age_group || null;

    let ageGroupRank: number | null = null;
    if (groupKey) {
      ageGroupRank = (groupCounts.get(groupKey) ?? 0) + 1;
      groupCounts.set(groupKey, ageGroupRank);
    }

    const slotIndex = split === "category" ? (categoryRank ?? 0) - 1 : i;
    const slot = slotIndex >= 0 ? prizes[slotIndex] : undefined;
    const prizeCents = slot ? prizeToCents(slot.amount) : 0;

    let ageGroupAward = false;
    if (offersAward && groupKey && !slot && !awarded.has(groupKey)) {
      awarded.add(groupKey);
      ageGroupAward = true;
    }

    updates.push(
      update.bind(
        rank,
        row.age_group,
        ageGroupRank,
        prizeCents,
        raceCategory,
        categoryRank,
        ageGroupAward ? 1 : 0,
        row.id
      )
    );

    standings.push({
      userId: row.user_id,
      rank,
      ageGroup: row.age_group,
      ageGroupRank,
      timeDisplay: row.time_display,
      heat: row.heat_number,
      prizeCents,
      raceCategory,
      categoryRank,
      ageGroupAward,
    });
  }

  // One batch: a single round trip, applied all or nothing.
  if (updates.length) await db.batch(updates);

  return standings;
}

/**
 * Whether this athlete has a result in a race paid by category. Their
 * category then decides places and prize money already given out, so only an
 * admin can change it.
 */
export async function hasCategoryResults(db: D1Database, userId: string): Promise<boolean> {
  const row = await db
    .prepare(
      `SELECT 1 AS found FROM results r JOIN events ev ON ev.id = r.event_id
       WHERE r.user_id = ? AND ev.prize_split = 'category' LIMIT 1`
    )
    .bind(userId)
    .first<{ found: number }>();
  return !!row;
}

/** Re-rank every event this athlete has a result in, e.g. after a DOB or category fix. */
export async function recomputeForAthlete(db: D1Database, userId: string) {
  const events = (await db
    .prepare("SELECT DISTINCT event_id FROM results WHERE user_id = ?")
    .bind(userId)
    .all()) as unknown as { results: { event_id: string }[] };
  for (const e of events.results) await recompute(db, e.event_id);
}
