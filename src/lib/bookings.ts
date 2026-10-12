import { generateId } from "@/lib/auth";
import { ageGroupOn } from "@/lib/agegroups";
import { formatEventDate, isDateTbc } from "@/lib/dates";
import { nowClockInMelbourne, todayInMelbourne } from "@/lib/events";
import { sendAdminAlertEmail, sendBookingEmail } from "@/lib/email";
import { formatFee } from "@/lib/money";
import {
  OCCUPYING_SQL,
  buildHeats,
  hasHeats,
  heatHasStarted,
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
    ? ` and carry a ${formatFee(cents)} admin fee`
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
  if (hasHeats(event)) {
    const heats = buildHeats(event);
    const last = heats[heats.length - 1];
    if (last && heatHasStarted(event, last.number, todayInMelbourne(), nowClockInMelbourne())) {
      return "Bookings have closed. The last heat has started.";
    }
  }
  return null;
}

async function adminEmails(db: D1Database): Promise<string[]> {
  const rows = (await db
    .prepare("SELECT email FROM users WHERE is_admin = 1")
    .all()) as unknown as { results: { email: string }[] };
  return rows.results.map((r) => r.email);
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
    if (heatHasStarted(event, heat, todayInMelbourne(), nowClockInMelbourne())) {
      return fail(400, "HEAT_STARTED", "That heat has already started. Pick a later one.");
    }
  }

  const existing = await db
    .prepare(
      "SELECT id, status, stripe_payment_id, created_at FROM entries WHERE event_id = ? AND user_id = ?"
    )
    .bind(event.id, user.id)
    .first<{ id: string; status: string; stripe_payment_id: string | null; created_at: string }>();

  if (existing?.status === "confirmed") {
    return fail(
      409,
      "ALREADY_BOOKED",
      withHeats
        ? "You already have a heat booked. To move, request a heat change."
        : "You are already entered."
    );
  }

  // A pending row means an unfinished checkout. It is only ever removed once
  // Stripe confirms that checkout is closed and unpaid; if it was paid (the
  // webhook just has not landed), the entry is confirmed instead. If Stripe
  // cannot be reached, nothing is touched and the athlete is asked to retry.
  if (existing) {
    if (!existing.stripe_payment_id) {
      // A checkout still being created by another request (a second tab).
      const ageMs = Date.now() - Date.parse(existing.created_at.replace(" ", "T") + "Z");
      if (Number.isFinite(ageMs) && ageMs < 60_000) {
        return fail(409, "IN_PROGRESS", "Your booking is already being set up. Give it a moment.");
      }
    } else {
      const outcome = await expireCheckoutSession(existing.stripe_payment_id);
      if (outcome === "paid") {
        const checkout = await retrieveCheckoutSession(existing.stripe_payment_id).catch(() => null);
        if (checkout) {
          await confirmPaidCheckout(db, {
            id: checkout.id,
            payment_status: checkout.payment_status,
            metadata: (checkout.metadata ?? null) as Record<string, string> | null,
          });
        }
        return fail(
          409,
          "ALREADY_BOOKED",
          withHeats
            ? "Your payment went through and your heat is booked."
            : "Your payment went through and you are entered."
        );
      }
      if (outcome === "unknown") {
        return fail(502, "PAYMENT_UNAVAILABLE", "Payments are unavailable right now. Try again shortly.");
      }
    }
    await db
      .prepare("DELETE FROM entries WHERE id = ? AND status = 'pending'")
      .bind(existing.id)
      .run();
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
      // The event-wide limit, checked in the same statement as the insert.
      const res = await db
        .prepare(
          `INSERT INTO entries (id, event_id, user_id, status, age_group)
           SELECT ?, ?, ?, ?, ?
           WHERE (SELECT COUNT(*) FROM entries WHERE event_id = ? AND ${OCCUPYING_SQL}) < ?`
        )
        .bind(entryId, event.id, user.id, status, ageGroup, event.id, event.max_entries ?? 1_000_000)
        .run();
      inserted = res.meta.changes ?? 0;
    }
  } catch {
    // UNIQUE(event_id, user_id): the same athlete booking from two tabs.
    return fail(409, "ALREADY_BOOKED", "You already have a booking for this event.");
  }

  if (!inserted) {
    return withHeats
      ? fail(409, "HEAT_FULL", "That heat has just filled up. Pick another one.")
      : fail(409, "EVENT_FULL", "This event is full.");
  }

  if (!paid) {
    await sendConfirmationOnce(db, entryId);
    return { ok: true, entryId, confirmed: true };
  }

  try {
    const checkout = await createCheckoutSession({
      entryId,
      heatNumber: heat,
      eventId: event.id,
      eventName: event.name,
      heatText: heatLabel(event, heat),
      entryFeeCents: event.entry_fee_cents,
      userId: user.id,
      userEmail: user.email,
      successUrl: `${SITE_URL}/events/${event.slug}/booked?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${SITE_URL}/events/${event.slug}/book?cancelled=1`,
    });

    const linked = await db
      .prepare("UPDATE entries SET stripe_payment_id = ? WHERE id = ? AND status = 'pending'")
      .bind(checkout.id, entryId)
      .run();
    if (!(linked.meta.changes ?? 0)) {
      // The row was replaced by a booking from another tab meanwhile.
      await expireCheckoutSession(checkout.id);
      return fail(409, "IN_PROGRESS", "Your booking was started in another tab. Refresh and try again.");
    }

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
): Promise<"confirmed" | "already" | "unpaid" | "recovered" | "duplicate" | "not_found"> {
  if (checkout.payment_status !== "paid") return "unpaid";

  const entry = await db
    .prepare("SELECT id, status FROM entries WHERE stripe_payment_id = ?")
    .bind(checkout.id)
    .first<{ id: string; status: string }>();

  if (entry) {
    const res = await db
      .prepare("UPDATE entries SET status = 'confirmed' WHERE id = ? AND status = 'pending'")
      .bind(entry.id)
      .run();
    await sendConfirmationOnce(db, entry.id);
    return (res.meta.changes ?? 0) > 0 ? "confirmed" : "already";
  }

  // The athlete paid but their entry row is gone (replaced by a later
  // attempt, or removed). The payment is the source of truth: rebuild it.
  const eventId = checkout.metadata?.event_id;
  const userId = checkout.metadata?.user_id;
  if (!eventId || !userId) {
    console.error("Paid checkout without booking metadata", checkout.id);
    return "not_found";
  }
  const heatNumber = Number(checkout.metadata?.heat_number) || null;

  const current = await db
    .prepare("SELECT id, status, stripe_payment_id FROM entries WHERE event_id = ? AND user_id = ?")
    .bind(eventId, userId)
    .first<{ id: string; status: string; stripe_payment_id: string | null }>();

  if (current?.status === "confirmed") {
    // Paid twice for one place. A person needs to refund one of them.
    console.error("Duplicate paid checkout", checkout.id);
    const admins = await adminEmails(db);
    if (admins.length) {
      await sendAdminAlertEmail(admins, "Duplicate payment needs a refund", [
        `Stripe checkout ${checkout.id} was paid by an athlete who already has a confirmed entry.`,
        `Event ${eventId}, athlete ${userId}.`,
        "Refund this checkout in the Stripe dashboard.",
      ]).catch(() => undefined);
    }
    return "duplicate";
  }

  const owner = await db
    .prepare(
      "SELECT u.date_of_birth, ev.date FROM users u, events ev WHERE u.id = ? AND ev.id = ?"
    )
    .bind(userId, eventId)
    .first<{ date_of_birth: string | null; date: string }>();
  if (!owner) {
    console.error("Paid checkout for a missing athlete or event", checkout.id);
    return "not_found";
  }

  let entryId: string;
  if (current) {
    // A newer unpaid attempt exists: this payment wins, close that checkout.
    if (current.stripe_payment_id && current.stripe_payment_id !== checkout.id) {
      await expireCheckoutSession(current.stripe_payment_id);
    }
    entryId = current.id;
    await db
      .prepare(
        "UPDATE entries SET status = 'confirmed', stripe_payment_id = ?, heat_number = COALESCE(?, heat_number) WHERE id = ?"
      )
      .bind(checkout.id, heatNumber, entryId)
      .run();
  } else {
    entryId = `ent_${generateId()}`;
    await db
      .prepare(
        "INSERT INTO entries (id, event_id, user_id, status, heat_number, age_group, stripe_payment_id) VALUES (?, ?, ?, 'confirmed', ?, ?, ?)"
      )
      .bind(entryId, eventId, userId, heatNumber, ageGroupOn(owner.date_of_birth, owner.date), checkout.id)
      .run();
  }

  console.error("Recovered a paid entry from checkout metadata", checkout.id);
  await sendConfirmationOnce(db, entryId);
  return "recovered";
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
      `SELECT e.id, e.status, e.heat_number, e.user_id, e.stripe_payment_id, u.email, u.name,
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
        stripe_payment_id: string | null;
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
          row.entry_fee_cents <= 0
            ? "Free entry"
            : row.stripe_payment_id
              ? `${formatFee(row.entry_fee_cents)} AUD, paid`
              : "Entered by Running TT",
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
