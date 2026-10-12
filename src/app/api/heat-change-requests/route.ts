import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { getSession, generateId } from "@/lib/auth";
import { heatLabel, type HeatConfig } from "@/lib/heats";
import { sendHeatChangeRequestEmail } from "@/lib/email";
import { SITE_URL } from "@/lib/site";

/**
 * An athlete asks to move heats. Changes are made by the team (and carry an
 * admin fee), so this records the request and tells the admins.
 */
export async function POST(request: NextRequest) {
  const db = await getDB();
  const session = await getSession(db);
  if (!session) return NextResponse.json({ error: "Sign in first" }, { status: 401 });

  let entryId = "";
  let requestedHeat: number | null = null;
  let note = "";
  try {
    const body = (await request.json()) as { entryId?: string; requestedHeat?: number | string | null; note?: string };
    entryId = typeof body.entryId === "string" ? body.entryId : "";
    const h = Number(body.requestedHeat);
    requestedHeat = body.requestedHeat === null || body.requestedHeat === "" || !Number.isInteger(h) ? null : h;
    note = typeof body.note === "string" ? body.note.trim().slice(0, 500) : "";
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const entry = await db
    .prepare(
      `SELECT e.id, e.event_id, e.heat_number, ev.name as event_name, ev.slug,
              ev.first_heat_time, ev.heat_interval_minutes, ev.heat_count, ev.heat_capacity
       FROM entries e JOIN events ev ON ev.id = e.event_id
       WHERE e.id = ? AND e.user_id = ? AND e.status = 'confirmed'`
    )
    .bind(entryId, session.user.id)
    .first<HeatConfig & { id: string; event_id: string; heat_number: number | null; event_name: string; slug: string }>();

  if (!entry) return NextResponse.json({ error: "Booking not found" }, { status: 404 });

  if (requestedHeat !== null && (requestedHeat < 1 || requestedHeat > (entry.heat_count ?? 0))) {
    return NextResponse.json({ error: "That heat does not exist" }, { status: 400 });
  }
  if (requestedHeat !== null && requestedHeat === entry.heat_number) {
    return NextResponse.json({ error: "You are already in that heat" }, { status: 400 });
  }

  const open = await db
    .prepare("SELECT id FROM heat_change_requests WHERE entry_id = ? AND status = 'open'")
    .bind(entry.id)
    .first();
  if (open) {
    return NextResponse.json(
      { error: "You already have a change request open. We will be in touch." },
      { status: 409 }
    );
  }

  await db
    .prepare(
      `INSERT INTO heat_change_requests (id, entry_id, event_id, user_id, current_heat, requested_heat, note)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(`hcr_${generateId()}`, entry.id, entry.event_id, session.user.id, entry.heat_number, requestedHeat, note || null)
    .run();

  const admins = (await db
    .prepare("SELECT email FROM users WHERE is_admin = 1")
    .all()) as unknown as { results: { email: string }[] };

  if (admins.results.length) {
    await sendHeatChangeRequestEmail(
      admins.results.map((a) => a.email),
      {
        athleteName: session.user.name,
        athleteEmail: session.user.email,
        eventName: entry.event_name,
        currentHeat: heatLabel(entry, entry.heat_number) || "No heat",
        requestedHeat: requestedHeat ? heatLabel(entry, requestedHeat) : "Any other heat",
        note,
        adminUrl: `${SITE_URL}/admin/events/${entry.slug}`,
      }
    ).catch(() => undefined);
  }

  return NextResponse.json({ success: true });
}
