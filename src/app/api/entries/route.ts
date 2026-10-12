import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { createBooking, EVENT_BOOKING_COLUMNS, type BookableEvent } from "@/lib/bookings";

/**
 * Book the signed-in athlete into an event (and a heat, when the event has
 * heats). Free events confirm straight away; paid events return a Stripe
 * Checkout URL and hold the heat spot while the athlete pays.
 */
export async function POST(request: NextRequest) {
  const db = await getDB();
  const session = await getSession(db);

  if (!session) {
    return NextResponse.json({ error: "Sign in to book", code: "AUTH" }, { status: 401 });
  }
  if (!session.user.profileCompleted) {
    return NextResponse.json(
      { error: "Finish setting up your profile before booking", code: "PROFILE", next: "/welcome" },
      { status: 403 }
    );
  }

  let eventId = "";
  let heatNumber: number | null = null;
  try {
    const body = (await request.json()) as { eventId?: string; heatNumber?: number | string };
    eventId = typeof body.eventId === "string" ? body.eventId : "";
    const h = Number(body.heatNumber);
    heatNumber = Number.isInteger(h) ? h : null;
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const event = await db
    .prepare(`SELECT ${EVENT_BOOKING_COLUMNS} FROM events WHERE id = ?`)
    .bind(eventId)
    .first<BookableEvent>();

  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const result = await createBooking(db, {
    event,
    user: {
      id: session.user.id,
      email: session.user.email,
      dateOfBirth: session.user.dateOfBirth,
    },
    heatNumber,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, code: result.code, holdReleased: result.holdReleased === true },
      { status: result.status }
    );
  }

  return NextResponse.json({
    success: true,
    entryId: result.entryId,
    confirmed: result.confirmed,
    checkoutUrl: result.checkoutUrl,
    next: result.checkoutUrl ? undefined : `/events/${event.slug}/booked`,
  });
}
