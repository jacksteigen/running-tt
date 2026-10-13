import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { generateId } from "@/lib/auth";
import { requireAdmin } from "@/lib/adminAuth";
import { isValidDob } from "@/lib/agegroups";
import { composeLocation, isKnownCountry } from "@/lib/countries";
import { isRaceCategory } from "@/lib/categories";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function clean(value: unknown, limit: number): string {
  return typeof value === "string" ? value.trim().slice(0, limit) : "";
}

/**
 * Create an athlete on someone's behalf, for walk-ups on race day. If they
 * later sign in with the same email, the account and results are theirs.
 */
export async function POST(request: NextRequest) {
  const db = await getDB();
  const auth = await requireAdmin(db);
  if (auth.denied) return auth.denied;

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const firstName = clean(body.firstName, 60);
  const lastName = clean(body.lastName, 60);
  const email = clean(body.email, 254).toLowerCase();
  const dateOfBirth = clean(body.dateOfBirth, 10);
  const city = clean(body.city, 60);
  const country = clean(body.country, 60);
  const raceCategory = body.raceCategory;

  if (!firstName || !lastName) {
    return NextResponse.json({ error: "First and last name are required" }, { status: 400 });
  }
  if (!isRaceCategory(raceCategory)) {
    return NextResponse.json({ error: "Pick the category they race in" }, { status: 400 });
  }
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "An email is needed so they can claim the account" }, { status: 400 });
  }
  if (dateOfBirth && !isValidDob(dateOfBirth)) {
    return NextResponse.json({ error: "Date of birth does not look right" }, { status: 400 });
  }
  if (country && !isKnownCountry(country)) {
    return NextResponse.json({ error: "Pick a country from the list" }, { status: 400 });
  }

  const existing = await db
    .prepare("SELECT id, name FROM users WHERE email = ?")
    .bind(email)
    .first<{ id: string; name: string }>();
  if (existing) {
    return NextResponse.json(
      { error: `${existing.name} already has an account with that email`, code: "EXISTS", userId: existing.id },
      { status: 409 }
    );
  }

  const id = `usr_${generateId()}`;
  const completed = dateOfBirth && city && country ? 1 : 0;
  await db
    .prepare(
      `INSERT INTO users (id, email, name, first_name, last_name, race_category, date_of_birth, city, country, location, profile_completed)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      id, email, `${firstName} ${lastName}`, firstName, lastName, raceCategory,
      dateOfBirth || null, city || null, country || null,
      composeLocation(city, country) || null, completed
    )
    .run();

  return NextResponse.json({ success: true, userId: id, name: `${firstName} ${lastName}` });
}
