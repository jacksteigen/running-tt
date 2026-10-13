import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { isRaceCategory, toRaceCategory } from "@/lib/categories";
import { hasCategoryResults, recomputeForAthlete } from "@/lib/standings";

const ALREADY_SET = "Your category is set. Ask us if it needs changing.";

/**
 * Fill in the category an athlete races in, from the one-question prompt on
 * the dashboard and before entering a race paid by category. It only fills a
 * missing category: changing one goes through the profile editor, or an
 * admin once it has counted in a race.
 */
export async function POST(request: NextRequest) {
  const db = await getDB();
  const session = await getSession(db);

  if (!session) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const raceCategory = body.raceCategory;
  if (!isRaceCategory(raceCategory)) {
    return NextResponse.json({ error: "Pick Women or Men" }, { status: 400 });
  }

  const current = await db
    .prepare("SELECT race_category FROM users WHERE id = ?")
    .bind(session.user.id)
    .first<{ race_category: string | null }>();
  const stored = toRaceCategory(current?.race_category);

  if (stored === raceCategory) {
    return NextResponse.json({ success: true, raceCategory });
  }
  if (stored) {
    return NextResponse.json({ error: ALREADY_SET }, { status: 409 });
  }

  // Raced in a race paid by category with no category on file: an admin sets
  // it, so the places and prize money from that race stay put.
  if (await hasCategoryResults(db, session.user.id)) {
    return NextResponse.json(
      {
        error:
          "You have already raced a category race without one, so ask us and we will set it for you.",
      },
      { status: 409 }
    );
  }

  const update = await db
    .prepare(
      "UPDATE users SET race_category = ?, updated_at = datetime('now') WHERE id = ? AND race_category IS NULL"
    )
    .bind(raceCategory, session.user.id)
    .run();
  if (!update.meta.changes) {
    // Set somewhere else in the meantime.
    const now = await db
      .prepare("SELECT race_category FROM users WHERE id = ?")
      .bind(session.user.id)
      .first<{ race_category: string | null }>();
    return toRaceCategory(now?.race_category) === raceCategory
      ? NextResponse.json({ success: true, raceCategory })
      : NextResponse.json({ error: ALREADY_SET }, { status: 409 });
  }

  // Fills in results that have no category yet, in races not paid by category.
  await recomputeForAthlete(db, session.user.id);

  return NextResponse.json({ success: true, raceCategory });
}
