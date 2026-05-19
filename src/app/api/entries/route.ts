import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { getSession, generateId } from "@/lib/auth";
import { createCheckoutSession } from "@/lib/stripe";

export async function POST(request: NextRequest) {
  const db = await getDB();
  const session = await getSession(db);

  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { eventId } = (await request.json()) as { eventId: string };

  const event = await db
    .prepare("SELECT * FROM events WHERE id = ?")
    .bind(eventId)
    .first<{
      id: string;
      slug: string;
      name: string;
      status: string;
      entry_fee_cents: number;
    }>();

  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  if (event.status !== "Open") {
    return NextResponse.json(
      { error: "Event is not open for entries" },
      { status: 400 }
    );
  }

  const existing = await db
    .prepare("SELECT id FROM entries WHERE event_id = ? AND user_id = ?")
    .bind(eventId, session.user.id)
    .first();

  if (existing) {
    return NextResponse.json(
      { error: "Already entered this event" },
      { status: 400 }
    );
  }

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

    const entryId = `ent_${generateId()}`;
    await db
      .prepare(
        "INSERT INTO entries (id, event_id, user_id, stripe_payment_id, status) VALUES (?, ?, ?, ?, 'pending')"
      )
      .bind(entryId, eventId, session.user.id, checkout.id)
      .run();

    return NextResponse.json({ checkoutUrl: checkout.url });
  }

  const entryId = `ent_${generateId()}`;
  await db
    .prepare(
      "INSERT INTO entries (id, event_id, user_id, status) VALUES (?, ?, ?, 'confirmed')"
    )
    .bind(entryId, eventId, session.user.id)
    .run();

  return NextResponse.json({ success: true });
}
