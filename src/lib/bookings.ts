import { generateId } from "@/lib/auth";
import { ageGroupOn } from "@/lib/agegroups";
import { formatEventDate, isDateTbc } from "@/lib/dates";
import { todayInMelbourne } from "@/lib/events";
import { sendBookingEmail } from "@/lib/email";
import {
  OCCUPYING_SQL,
  hasHeats,
  heatLabel,
  type HeatConfig,
} from "@/lib/heats";
import {
  createCheckoutSession,
  expireCheckoutSession,
  retrieveCheckoutSession,
} from "@/lib/stripe";
import { SITE_URL } from "@/lib/site";

export interface BookableEvent extends HeatConfig {
  id: string;
  slug: string;
  name: string;
  distance: string;
  date: string;
  time: string;
  venue: string;
  location: string;
  status: string;
  entry_fee_cents: number;
  max_entries: number | null;
  change_fee_cents: number | null;
}

export const EVENT_BOOKING_COLUMNS = `id, slug, name, distance, date, time, venue, location, status,
  entry_fee_cents, max_entries, change_fee_cents,
  first_heat_time, heat_interval_minutes, heat_count, heat_capacity`;

export type BookingResult =
  | { ok: true; entryId: string; confirmed: boolean; checkoutUrl?: string }
  | { ok: false; status: number; code: string; error: string };

function fail(status: number, code: string, error: string): BookingResult {
  return { ok: false, status, code, error };
}

/** Short, readable reference for tickets and emails: RTT-3F9A2C. */
export function bookingRef(entryId: string): string {
  return `RTT-${entryId.replace(/^ent_/, "").slice(-6).toUpperCase()}`;
}

export function changeFeeText(cents: number | null | undefined): string {
  return cents && cents > 0
    ? ` and carry a $${(cents / 100).toFixed(cents % 100 ? 2 : 0)} admin fee`
    : " and an admin fee applies";
}

/** Why an event is not taking bookings right now, or null if it is. */
export function bookingClosedReason(event: BookableEvent): string | null {
  if (isDateTbc(event.date)) return "Bookings open once the date is locked in.";
  if (event.date < todayInMelbourne()) return "This event has finished.";
  if (event.status === "Coming Soon") return "Bookings open soon.";
  if (event.status === "Sold Out") return "This event is sold out.";
  if (event.status !== "Open") return "Bookings are closed.";
  if (hasHeats(event) && !event.first_heat_time) return "Heat times are being finalised.";
  return null;
}

/**
 * Book an athlete into an event, and into a heat when the event has heats.
 * The capacity check and the insert are one statement, so two people racing
 * for the last spot in a heat cannot both get it.
 */
export async function createBooking(
  db: D1Database,
  {
    event,
    user,
    heatNumber,
  }: {
    event: BookableEvent;
    user: { id: string; email: string; dateOfBirth: string | null };
    heatNumber: number | null;
  }
): Promise<BookingResult> {
  const closed = bookingClosedReason(event);
  if (closed) return fail(400, "CLOSED", closed);

  const withHeats = hasHeats(event);
  let heat: number | null = null;
  if (withHeats) {
    if (
      !Number.isInteger(heatNumber) ||
      (heatNumber as number) < 1 ||
      (heatNumber as number) > (event.heat_count as number)
    ) {
      return fail(400, "HEAT_REQUIRED", "Pick a heat to book.");
    }
    heat = heatNumber as number;
  }

  const existing = await db
    .prepare(
      "SELECT id, status, stripe_payment_id FROM entries WHERE event_id = ? AND user_id = ?"
    )
    .bind(event.id, user.id)
    .first<{ id: string; status: string; stripe_payment_id: string | null }>();

  if (existing?.status === "confirmed") {
    return fail(
      409,
      "ALREADY_BOOKED",
      withHeats
        ? "You already have a heat booked. To move, request a heat change."
        : "You are already entered."
    );
  }

  // A pending row means an unfinished checkout. If Stripe says it was in
  // fact paid (the webhook just has not landed yet), confirm it rather than
  // throwing away a paid entry. Otherwise close it and start again so nobody
  // is ever locked out by an abandoned payment page.
  if (existing) {
    if (existing.stripe_payment_id) {
      let paidCheckout: Awaited<ReturnType<typeof retrieveCheckoutSession>> | null = null;
      try {
        paidCheckout = await retrieveCheckoutSession(existing.stripe_payment_id);
      } catch {
        paidCheckout = null;
      }
      if (paidCheckout && paidCheckout.payment_status === "paid") {
        await confirmPaidCheckout(db, {
          id: paidCheckout.id,
          payment_status: paidCheckout.payment_status,
          metadata: (paidCheckout.metadata ?? null) as Record<string, string> | null,
        });
        return fail(
          409,
          "ALREADY_BOOKED",
          withHeats
            ? "Your payment went through and your heat is booked."
            : "Your payment went through and you are entered."
        );
      }
      await expireCheckoutSession(existing.stripe_payment_id);
    }
    await db
      .prepare("DELETE FROM entries WHERE id = ? AND status = 'pending'")
      .bind(existing.id)
      .run();
  }

  if (!withHeats && event.max_entries) {
    const count = await db
      .prepare(`SELECT COUNT(*) as n FROM entries WHERE event_id = ? AND ${OCCUPYING_SQL}`)
      .bind(event.id)
      .first<{ n: number }>();
    if ((count?.n ?? 0) >= event.max_entries) {
      return fail(409, "EVENT_FULL", "This event is full.");
    }
  }

  const paid = event.entry_fee_cents > 0;
  const entryId = `ent_${generateId()}`;
  const ageGroup = ageGroupOn(user.dateOfBirth, event.date);
  const status = paid ? "pending" : "confirmed";

  let inserted = 0;
  try {
    if (withHeats) {
      const res = await db
        .prepare(
          `INSERT INTO entries (id, event_id, user_id, status, heat_number, age_group)
           SELECT ?, ?, ?, ?, ?, ?
           WHERE (SELECT COUNT(*) FROM entries
                  WHERE event_id = ? AND heat_number = ? AND ${OCCUPYING_SQL}) < ?`
        )
        .bind(
          entryId,
          event.id,
          user.id,
          status,
          heat,
          ageGroup,
          event.id,
          heat,
          event.heat_capacity && event.heat_capacity > 0 ? event.heat_capacity : 10
        )
        .run();
      inserted = res.meta.changes ?? 0;
    } else {
      const res = await db
        .prepare(
          "INSERT INTO entries (id, event_id, user_id, status, age_group) VALUES (?, ?, ?, ?, ?)"
        )
        .bind(entryId, event.id, user.id, status, ageGroup)
        .run();
      inserted = res.meta.changes ?? 0;
    }
  } catch {
    // UNIQUE(event_id, user_id): the same athlete booking from two tabs.
    return fail(409, "ALREADY_BOOKED", "You already have a booking for this event.");
  }

  if (!inserted) {
    return fail(409, "HEAT_FULL", "That heat has just filled up. Pick another one.");
  }

  if (!paid) {
    await sendConfirmationOnce(db, entryId);
    return { ok: true, entryId, confirmed: true };
  }

  try {
    const checkout = await createCheckoutSession({
      entryId,
      eventId: event.id,
      eventName: event.name,
      heatText: heatLabel(event, heat),
      entryFeeCents: event.entry_fee_cents,
      userId: user.id,
      userEmail: user.email,
      successUrl: `${SITE_URL}/events/${event.slug}/booked?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${SITE_URL}/events/${event.slug}/book?cancelled=1`,
    });

    await db
      .prepare("UPDATE entries SET stripe_payment_id = ? WHERE id = ?")
      .bind(checkout.id, entryId)
      .run();

    return { ok: true, entryId, confirmed: false, checkoutUrl: checkout.url ?? undefined };
  } catch (err) {
    console.error("Checkout creation failed", err instanceof Error ? err.message : "unknown");
    await db.prepare("DELETE FROM entries WHERE id = ?").bind(entryId).run();
    return fail(502, "PAYMENT_UNAVAILABLE", "Payments are unavailable right now. Try again shortly.");
  }
}

/**
 * Confirm the entry behind a paid Stripe Checkout session. Used by the
 * webhook and, as a backstop, by the booking page Stripe returns to. Safe to
 * call any number of times.
 */
export async function confirmPaidCheckout(
  db: D1Database,
  checkout: {
    id: string;
    payment_status: string | null;
    metadata: Record<string, string> | null;
  }
): Promise<"confirmed" | "already" | "unpaid" | "not_found"> {
  if (checkout.payment_status !== "paid") return "unpaid";

  const entry = await db
    .prepare("SELECT id, status FROM entries WHERE stripe_payment_id = ?")
    .bind(checkout.id)
    .first<{ id: string; status: string }>();

  if (!entry) {
    console.error("Paid checkout with no matching entry", checkout.id);
    return "not_found";
  }

  const res = await db
    .prepare("UPDATE entries SET status = 'confirmed' WHERE id = ? AND status = 'pending'")
    .bind(entry.id)
    .run();

  await sendConfirmationOnce(db, entry.id);
  return (res.meta.changes ?? 0) > 0 ? "confirmed" : "already";
}

/** Release the spot held by a checkout that expired unpaid. */
export async function releaseExpiredCheckout(db: D1Database, checkoutId: string) {
  await db
    .prepare("DELETE FROM entries WHERE stripe_payment_id = ? AND status = 'pending'")
    .bind(checkoutId)
    .run();
}

async function loadEntryForEmail(db: D1Database, entryId: string) {
  return db
    .prepare(
      `SELECT e.id, e.status, e.heat_number, e.user_id, u.email, u.name,
              ev.slug, ev.name as event_name, ev.distance, ev.date, ev.venue, ev.location,
              ev.entry_fee_cents, ev.change_fee_cents,
              ev.first_heat_time, ev.heat_interval_minutes, ev.heat_count, ev.heat_capacity
       FROM entries e
       JOIN users u ON u.id = e.user_id
       JOIN events ev ON ev.id = e.event_id
       WHERE e.id = ?`
    )
    .bind(entryId)
    .first<
      HeatConfig & {
        id: string;
        status: string;
        heat_number: number | null;
        user_id: string;
        email: string;
        name: string;
        slug: string;
        event_name: string;
        distance: string;
        date: string;
        venue: string;
        location: string;
        entry_fee_cents: number;
        change_fee_cents: number | null;
      }
    >();
}

async function sendFor(
  db: D1Database,
  entryId: string,
  variant: "booked" | "changed"
): Promise<boolean> {
  const row = await loadEntryForEmail(db, entryId);
  if (!row || row.status !== "confirmed") return false;
  try {
    const sent = await sendBookingEmail(
      row.email,
      {
        athleteName: row.name,
        eventName: row.event_name,
        distance: row.distance,
        dateText: formatEventDate(row.date, "long"),
        heatText: heatLabel(row, row.heat_number),
        venue: row.venue,
        location: row.location,
        amountText:
          row.entry_fee_cents > 0
            ? `$${(row.entry_fee_cents / 100).toFixed(0)} AUD, paid`
            : "Free entry",
        bookingRef: bookingRef(row.id),
        changeFeeText: changeFeeText(row.change_fee_cents),
        manageUrl: `${SITE_URL}/events/${row.slug}/booked`,
      },
      variant
    );
    return sent.success;
  } catch {
    return false;
  }
}

/**
 * Send the confirmation email exactly once per entry. The flag is claimed
 * before sending so the webhook and the return page cannot both send it,
 * and released again if the send fails so a later call can retry.
 */
export async function sendConfirmationOnce(db: D1Database, entryId: string) {
  const claim = await db
    .prepare(
      "UPDATE entries SET confirmation_sent_at = datetime('now') WHERE id = ? AND status = 'confirmed' AND confirmation_sent_at IS NULL"
    )
    .bind(entryId)
    .run();
  if (!(claim.meta.changes ?? 0)) return;

  const ok = await sendFor(db, entryId, "booked");
  if (!ok) {
    await db
      .prepare("UPDATE entries SET confirmation_sent_at = NULL WHERE id = ?")
      .bind(entryId)
      .run();
  }
}

/** Tell an athlete their heat was moved. */
export async function sendHeatChangedEmail(db: D1Database, entryId: string) {
  return sendFor(db, entryId, "changed");
}
