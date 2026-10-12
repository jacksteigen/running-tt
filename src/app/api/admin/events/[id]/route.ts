import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { requireAdmin } from "@/lib/adminAuth";
import { parseEventInput, slugify } from "@/lib/eventInput";
import { ageGroupOn } from "@/lib/agegroups";
import { OCCUPYING_SQL } from "@/lib/heats";

/** Update an event. Refuses changes that would strand booked athletes. */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = await getDB();
  const auth = await requireAdmin(db);
  if (auth.denied) return auth.denied;

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const current = await db
    .prepare("SELECT id, slug, date FROM events WHERE id = ?")
    .bind(id)
    .first<{ id: string; slug: string; date: string }>();
  if (!current) return NextResponse.json({ error: "Event not found" }, { status: 404 });

  const parsed = parseEventInput(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const f = parsed.fields;

  // Bookings constrain what the heats can become.
  const usage = await db
    .prepare(
      `SELECT MAX(heat_number) as max_heat,
              (SELECT MAX(n) FROM (SELECT COUNT(*) as n FROM entries
                 WHERE event_id = ? AND heat_number IS NOT NULL AND ${OCCUPYING_SQL}
                 GROUP BY heat_number)) as max_in_heat,
              COUNT(*) as with_heat
       FROM entries WHERE event_id = ? AND heat_number IS NOT NULL AND ${OCCUPYING_SQL}`
    )
    .bind(id, id)
    .first<{ max_heat: number | null; max_in_heat: number | null; with_heat: number }>();

  if (usage && usage.with_heat > 0) {
    if (!f.heat_count) {
      return NextResponse.json(
        { error: "Athletes are booked into heats, so heat booking cannot be switched off" },
        { status: 400 }
      );
    }
    if ((usage.max_heat ?? 0) > f.heat_count) {
      return NextResponse.json(
        { error: `Heat ${usage.max_heat} has bookings. Move those athletes before cutting the number of heats.` },
        { status: 400 }
      );
    }
    if ((usage.max_in_heat ?? 0) > (f.heat_capacity ?? 0)) {
      return NextResponse.json(
        { error: `One heat already has ${usage.max_in_heat} athletes, more than the new limit.` },
        { status: 400 }
      );
    }
  }

  let slug = current.slug;
  if (typeof body.slug === "string" && body.slug.trim() && slugify(body.slug) !== current.slug) {
    slug = slugify(body.slug);
    const taken = await db
      .prepare("SELECT id FROM events WHERE slug = ? AND id != ?")
      .bind(slug, id)
      .first();
    if (!slug || taken) {
      return NextResponse.json({ error: "That web address is already used by another event" }, { status: 400 });
    }
  }

  await db
    .prepare(
      `UPDATE events SET slug = ?, name = ?, distance = ?, date = ?, time = ?, venue = ?, location = ?,
         status = ?, entry_fee_cents = ?, description = ?, check_in = ?, what_to_bring = ?, prizes = ?,
         first_heat_time = ?, heat_interval_minutes = ?, heat_count = ?, heat_capacity = ?, change_fee_cents = ?
       WHERE id = ?`
    )
    .bind(
      slug, f.name, f.distance, f.date, f.time, f.venue, f.location, f.status,
      f.entry_fee_cents, f.description, f.check_in, f.what_to_bring, f.prizes,
      f.first_heat_time, f.heat_interval_minutes, f.heat_count, f.heat_capacity, f.change_fee_cents,
      id
    )
    .run();

  // A new date can move athletes between age groups.
  if (f.date !== current.date) {
    const rows = (await db
      .prepare(
        "SELECT e.id, u.date_of_birth FROM entries e JOIN users u ON u.id = e.user_id WHERE e.event_id = ?"
      )
      .bind(id)
      .all()) as unknown as { results: { id: string; date_of_birth: string | null }[] };
    for (const r of rows.results) {
      await db
        .prepare("UPDATE entries SET age_group = ? WHERE id = ?")
        .bind(ageGroupOn(r.date_of_birth, f.date), r.id)
        .run();
    }
  }

  return NextResponse.json({ success: true, slug });
}

/** Delete an event that nobody has entered yet. */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = await getDB();
  const auth = await requireAdmin(db);
  if (auth.denied) return auth.denied;

  const used = await db
    .prepare(
      "SELECT (SELECT COUNT(*) FROM entries WHERE event_id = ?) + (SELECT COUNT(*) FROM results WHERE event_id = ?) as n"
    )
    .bind(id, id)
    .first<{ n: number }>();
  if ((used?.n ?? 0) > 0) {
    return NextResponse.json(
      { error: "This event has entries or results, so it cannot be deleted" },
      { status: 400 }
    );
  }

  await db.prepare("DELETE FROM heat_change_requests WHERE event_id = ?").bind(id).run();
  await db.prepare("DELETE FROM events WHERE id = ?").bind(id).run();
  return NextResponse.json({ success: true });
}
