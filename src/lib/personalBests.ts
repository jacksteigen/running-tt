import { formatSeconds } from "@/lib/racetime";
import { generateId } from "@/lib/auth";

/**
 * A personal best is the fastest recorded result at a distance. It is
 * recomputed from results after every change, so correcting a mistyped time
 * (in either direction) always leaves the PB right.
 */
export async function recomputePersonalBest(
  db: D1Database,
  userId: string,
  distance: string
) {
  const best = await db
    .prepare(
      `SELECT r.time_seconds, r.event_id FROM results r
       JOIN events ev ON ev.id = r.event_id
       WHERE r.user_id = ? AND ev.distance = ?
       ORDER BY r.time_seconds ASC LIMIT 1`
    )
    .bind(userId, distance)
    .first<{ time_seconds: number; event_id: string }>();

  if (!best) {
    await db
      .prepare("DELETE FROM personal_bests WHERE user_id = ? AND distance = ?")
      .bind(userId, distance)
      .run();
    return;
  }

  const display = formatSeconds(best.time_seconds);
  const existing = await db
    .prepare("SELECT id FROM personal_bests WHERE user_id = ? AND distance = ?")
    .bind(userId, distance)
    .first<{ id: string }>();

  if (existing) {
    await db
      .prepare(
        "UPDATE personal_bests SET time_seconds = ?, time_display = ?, event_id = ?, verified = 1 WHERE id = ?"
      )
      .bind(best.time_seconds, display, best.event_id, existing.id)
      .run();
  } else {
    await db
      .prepare(
        `INSERT INTO personal_bests (id, user_id, distance, time_seconds, time_display, event_id, verified)
         VALUES (?, ?, ?, ?, ?, ?, 1)`
      )
      .bind(`pb_${generateId()}`, userId, distance, best.time_seconds, display, best.event_id)
      .run();
  }
}
