import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { generateId } from "@/lib/auth";
import { requireAdmin } from "@/lib/adminAuth";
import { parseEventInput, slugify } from "@/lib/eventInput";

/** Create an event. */
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

  const parsed = parseEventInput(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const f = parsed.fields;

  const base = slugify(typeof body.slug === "string" && body.slug.trim() ? body.slug : f.name);
  if (!base) return NextResponse.json({ error: "The event needs a web address" }, { status: 400 });

  let slug = base;
  for (let i = 2; i < 50; i++) {
    const taken = await db.prepare("SELECT id FROM events WHERE slug = ?").bind(slug).first();
    if (!taken) break;
    slug = `${base}-${i}`;
  }

  const id = `evt_${generateId()}`;
  await db
    .prepare(
      `INSERT INTO events (id, slug, name, distance, date, time, venue, location, status,
         entry_fee_cents, description, check_in, what_to_bring, prizes, prize_split, age_group_prize,
         first_heat_time, heat_interval_minutes, heat_count, heat_capacity, change_fee_cents, is_test)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      id, slug, f.name, f.distance, f.date, f.time, f.venue, f.location, f.status,
      f.entry_fee_cents, f.description, f.check_in, f.what_to_bring, f.prizes, f.prize_split, f.age_group_prize,
      f.first_heat_time, f.heat_interval_minutes, f.heat_count, f.heat_capacity, f.change_fee_cents, f.is_test
    )
    .run();

  return NextResponse.json({ success: true, id, slug });
}
