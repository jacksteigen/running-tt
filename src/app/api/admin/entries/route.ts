import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { getSession, generateId } from "@/lib/auth";
import { ageGroupOn } from "@/lib/agegroups";

/** Add an athlete to an event by hand (walk-ups, fixes). */
export async function POST(request: NextRequest) {
  const db = await getDB();
  const session = await getSession(db);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!session.user.isAdmin) return NextResponse.json({ error: "Not permitted" }, { status: 403 });

  let eventId = "";
  let userId = "";
  try {
    const body = (await request.json()) as { eventId?: string; userId?: string };
    eventId = typeof body.eventId === "string" ? body.eventId : "";
    userId = typeof body.userId === "string" ? body.userId : "";
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const event = await db
    .prepare("SELECT id, date FROM events WHERE id = ?")
    .bind(eventId)
    .first<{ id: string; date: string }>();
  const user = await db
    .prepare("SELECT id, date_of_birth FROM users WHERE id = ?")
    .bind(userId)
    .first<{ id: string; date_of_birth: string | null }>();

  if (!event || !user) {
    return NextResponse.json({ error: "Event or athlete not found" }, { status: 404 });
  }

  const existing = await db
    .prepare("SELECT id, status FROM entries WHERE event_id = ? AND user_id = ?")
    .bind(eventId, userId)
    .first<{ id: string; status: string }>();

  const ageGroup = ageGroupOn(user.date_of_birth, event.date);

  if (existing) {
    await db
      .prepare("UPDATE entries SET status = 'confirmed', age_group = ? WHERE id = ?")
      .bind(ageGroup, existing.id)
      .run();
    return NextResponse.json({ success: true, entryId: existing.id });
  }

  const entryId = `ent_${generateId()}`;
  await db
    .prepare(
      "INSERT INTO entries (id, event_id, user_id, status, age_group) VALUES (?, ?, ?, 'confirmed', ?)"
    )
    .bind(entryId, eventId, userId, ageGroup)
    .run();

  return NextResponse.json({ success: true, entryId });
}
