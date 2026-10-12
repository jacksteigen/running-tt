import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ageGroupOn, isValidDob } from "@/lib/agegroups";
import { composeLocation, isKnownCountry } from "@/lib/countries";

function clean(value: unknown, limit: number): string {
  return typeof value === "string" ? value.trim().slice(0, limit) : "";
}

/**
 * First-run profile. Every athlete completes this once before they can use
 * the dashboard or enter an event, so that names, ages and age groups on
 * results are real from day one.
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

  const firstName = clean(body.firstName, 60);
  const middleName = clean(body.middleName, 60);
  const lastName = clean(body.lastName, 60);
  const dateOfBirth = clean(body.dateOfBirth, 10);
  const city = clean(body.city, 60);
  const country = clean(body.country, 60);
  const location = composeLocation(city, country);
  const bio = clean(body.bio, 600);

  if (!firstName) {
    return NextResponse.json({ error: "First name is required" }, { status: 400 });
  }
  if (!lastName) {
    return NextResponse.json({ error: "Last name is required" }, { status: 400 });
  }
  if (!isValidDob(dateOfBirth)) {
    return NextResponse.json(
      { error: "Enter a real date of birth" },
      { status: 400 }
    );
  }
  if (!city) {
    return NextResponse.json({ error: "Which town or city are you based in?" }, { status: 400 });
  }
  if (!isKnownCountry(country)) {
    return NextResponse.json({ error: "Pick your country from the list" }, { status: 400 });
  }
  if (bio.length < 10) {
    return NextResponse.json(
      { error: "Tell us a little about yourself, at least a sentence" },
      { status: 400 }
    );
  }

  const name = `${firstName} ${lastName}`;

  await db
    .prepare(
      `UPDATE users
       SET first_name = ?, middle_name = ?, last_name = ?, name = ?,
           date_of_birth = ?, city = ?, country = ?, location = ?, bio = ?,
           profile_completed = 1, updated_at = datetime('now')
       WHERE id = ?`
    )
    .bind(
      firstName,
      middleName || null,
      lastName,
      name,
      dateOfBirth,
      city,
      country,
      location,
      bio,
      session.user.id
    )
    .run();

  // Any entries made before the profile was complete get their age group now.
  const pending = await db
    .prepare(
      `SELECT e.id, ev.date FROM entries e
       JOIN events ev ON ev.id = e.event_id
       WHERE e.user_id = ?`
    )
    .bind(session.user.id)
    .all() as unknown as { results: { id: string; date: string }[] };

  for (const entry of pending.results) {
    await db
      .prepare("UPDATE entries SET age_group = ? WHERE id = ?")
      .bind(ageGroupOn(dateOfBirth, entry.date), entry.id)
      .run();
  }

  return NextResponse.json({ success: true, name });
}
