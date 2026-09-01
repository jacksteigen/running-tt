import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ageGroupOn, isValidDob } from "@/lib/agegroups";

function clean(value: unknown, limit: number): string {
  return typeof value === "string" ? value.trim().slice(0, limit) : "";
}

/** Admin edit of an athlete's core profile. */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = await getDB();
  const session = await getSession(db);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!session.user.isAdmin) return NextResponse.json({ error: "Not permitted" }, { status: 403 });

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const target = await db
    .prepare("SELECT id FROM users WHERE id = ?")
    .bind(id)
    .first<{ id: string }>();
  if (!target) {
    return NextResponse.json({ error: "Athlete not found" }, { status: 404 });
  }

  const firstName = clean(body.firstName, 60);
  const middleName = clean(body.middleName, 60);
  const lastName = clean(body.lastName, 60);
  const dateOfBirth = clean(body.dateOfBirth, 10);
  const location = clean(body.location, 80);
  const bio = clean(body.bio, 600);
  const isAdmin = body.isAdmin === true;

  if (!firstName || !lastName) {
    return NextResponse.json({ error: "First and last name are required" }, { status: 400 });
  }
  if (dateOfBirth && !isValidDob(dateOfBirth)) {
    return NextResponse.json({ error: "Date of birth does not look right" }, { status: 400 });
  }
  if (id === session.user.id && !isAdmin) {
    return NextResponse.json({ error: "You cannot remove your own admin access" }, { status: 400 });
  }

  const completed = firstName && lastName && dateOfBirth && location ? 1 : 0;

  await db
    .prepare(
      `UPDATE users
       SET first_name = ?, middle_name = ?, last_name = ?, name = ?,
           date_of_birth = ?, location = ?, bio = ?, is_admin = ?,
           profile_completed = ?, updated_at = datetime('now')
       WHERE id = ?`
    )
    .bind(
      firstName,
      middleName || null,
      lastName,
      `${firstName} ${lastName}`,
      dateOfBirth || null,
      location || null,
      bio || null,
      isAdmin ? 1 : 0,
      completed,
      id
    )
    .run();

  // Keep age groups on this athlete's entries in step with the new DOB.
  const entries = await db
    .prepare(
      "SELECT e.id, ev.date FROM entries e JOIN events ev ON ev.id = e.event_id WHERE e.user_id = ?"
    )
    .bind(id)
    .all() as unknown as { results: { id: string; date: string }[] };
  for (const entry of entries.results) {
    await db
      .prepare("UPDATE entries SET age_group = ? WHERE id = ?")
      .bind(ageGroupOn(dateOfBirth || null, entry.date), entry.id)
      .run();
  }

  return NextResponse.json({ success: true });
}
