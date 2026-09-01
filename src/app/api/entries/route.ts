import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { getSession, generateId } from "@/lib/auth";
import { createCheckoutSession } from "@/lib/stripe";
import { todayInMelbourne } from "@/lib/events";
import { ageGroupOn } from "@/lib/agegroups";

export async function POST(request: NextRequest) {
  const db = await getDB();
  const session = await getSession(db);

  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // The clean sport declaration is signed once, at sign-up, and covers every
  // entry. The athlete profile has to be complete so the entry carries a
  // real name and an age group.
  if (!session.user.profileCompleted) {
    return NextResponse.json(
      { error: "Finish setting up your profile before entering", next: "/welcome" },
      { status: 403 }
    );
  }

  let eventId = "";
  try {
    const body = (await request.json()) as { eventId?: string };
    eventId = typeof body.eventId === "string" ? body.eventId : "";
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const event = await db
    .prepare(
      "SELECT id, slug, name, date, status, entry_fee_cents, max_entries FROM events WHERE id = ?"
    )
    .bind(eventId)
    .first<{
      id: string;
      slug: string;
      name: string;
      date: string;
      status: string;
      entry_fee_cents: number;
      max_entries: number | null;
    }>();

  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  if (event.status !== "Open" || event.date < todayInMelbourne()) {
    return NextResponse.json(
      { error: "Entries for this event are closed" },
      { status: 400 }
    );
  }

  const existing = await db
    .prepare(
      "SELECT id, status, created_at FROM entries WHERE event_id = ? AND user_id = ?"
    )
    .bind(eventId, session.user.id)
    .first<{ id: string; status: string; created_at: string }>();

  if (existing?.status === "confirmed") {
    return NextResponse.json(
      { error: "You are already entered" },
      { status: 400 }
    );
  }

  // An abandoned checkout leaves a pending row behind; clear it and start
  // again rather than locking the athlete out.
  if (existing) {
    await db.prepare("DELETE FROM entries WHERE id = ?").bind(existing.id).run();
  }

  if (event.max_entries) {
    const count = await db
      .prepare(
        "SELECT COUNT(*) as n FROM entries WHERE event_id = ? AND status = 'confirmed'"
      )
      .bind(eventId)
      .first<{ n: number }>();
    if ((count?.n ?? 0) >= event.max_entries) {
      return NextResponse.json({ error: "This event is full" }, { status: 400 });
    }
  }

  const ageGroup = ageGroupOn(session.user.dateOfBirth, event.date);
  const entryId = `ent_${generateId()}`;
  const baseUrl = new URL(request.url).origin;

  if (event.entry_fee_cents > 0) {
    const checkout = await createCheckoutSession({
      eventId: event.id,
      eventName: event.name,
      entryFeeCents: event.entry_fee_cents,
      userId: session.user.id,
      userEmail: session.user.email,
      successUrl: `${baseUrl}/dashboard?entered=${event.id}`,
      cancelUrl: `${baseUrl}/events/${event.slug}`,
    });

    await db
      .prepare(
        "INSERT INTO entries (id, event_id, user_id, stripe_payment_id, status, age_group) VALUES (?, ?, ?, ?, 'pending', ?)"
      )
      .bind(entryId, eventId, session.user.id, checkout.id, ageGroup)
      .run();

    return NextResponse.json({ checkoutUrl: checkout.url });
  }

  await db
    .prepare(
      "INSERT INTO entries (id, event_id, user_id, status, age_group) VALUES (?, ?, ?, 'confirmed', ?)"
    )
    .bind(entryId, eventId, session.user.id, ageGroup)
    .run();

  return NextResponse.json({ success: true });
}
