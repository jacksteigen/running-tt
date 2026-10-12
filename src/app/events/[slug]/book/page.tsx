import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getDB } from "@/lib/db";
import { getSession } from "@/lib/auth";
import {
  EVENT_BOOKING_COLUMNS,
  bookingClosedReason,
  changeFeeText,
  confirmPaidCheckout,
  type BookableEvent,
} from "@/lib/bookings";
import { formatEventDate, isDateTbc } from "@/lib/dates";
import { HOLD_MINUTES, getHeatAvailability, hasHeats, isValidClock } from "@/lib/heats";
import { todayInMelbourne } from "@/lib/events";
import { formatFee } from "@/lib/money";
import { retrieveCheckoutSession } from "@/lib/stripe";
import HeatPicker, { type PickerClosedKind, type PickerViewer } from "@/components/HeatPicker";
import { BookingSteps } from "@/components/BookingTicket";

export const dynamic = "force-dynamic";

type BookingEvent = BookableEvent & { description: string | null };

async function loadEvent(slug: string) {
  const db = await getDB();
  return db
    .prepare(`SELECT ${EVENT_BOOKING_COLUMNS}, description FROM events WHERE slug = ?`)
    .bind(slug)
    .first<BookingEvent>();
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const event = await loadEvent(slug);
  return {
    title: event ? `Book your heat · ${event.name} · Running TT` : "Book your heat · Running TT",
    robots: { index: false, follow: false },
  };
}

/**
 * Whether closed bookings will open later (a TBC date, Coming Soon, or heat
 * times still being set) or are closed for good (sold out, finished, or the
 * last heat has started). Follows the order of bookingClosedReason().
 */
function closedKind(event: BookableEvent): PickerClosedKind {
  if (isDateTbc(event.date)) return "soon";
  if (event.date < todayInMelbourne()) return "final";
  if (event.status === "Coming Soon") return "soon";
  if (event.status !== "Open") return "final";
  if (hasHeats(event) && !event.first_heat_time) return "soon";
  return "final";
}

/** Short label for the disabled booking button while bookings are closed. */
function closedCta(event: BookableEvent) {
  if (closedKind(event) === "soon") return "Booking opens soon";
  if (event.date < todayInMelbourne()) return "Event finished";
  if (event.status === "Sold Out") return "Sold out";
  return "Bookings closed";
}

export default async function BookHeatPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ heat?: string; cancelled?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const db = await getDB();

  const event = await loadEvent(slug);
  if (!event) notFound();
  if (!hasHeats(event)) redirect(`/events/${slug}`);

  const session = await getSession(db);

  // An unpaid checkout of theirs is still holding a spot. If Stripe has in
  // fact taken the money, confirm it now rather than letting them book twice.
  let heldHeat: number | null = null;
  let heldSince: string | null = null;
  if (session) {
    const entry = await db
      .prepare(
        `SELECT id, status, heat_number, stripe_payment_id, created_at,
                (created_at > datetime('now', '-${HOLD_MINUTES} minutes')) as holding
         FROM entries WHERE event_id = ? AND user_id = ?`
      )
      .bind(event.id, session.user.id)
      .first<{
        id: string;
        status: string;
        heat_number: number | null;
        stripe_payment_id: string | null;
        created_at: string;
        holding: number;
      }>();

    if (entry?.status === "confirmed") redirect(`/events/${slug}/booked`);

    if (entry?.status === "pending") {
      let paid = false;
      if (entry.stripe_payment_id) {
        try {
          const checkout = await retrieveCheckoutSession(entry.stripe_payment_id);
          if (checkout.payment_status === "paid") {
            const outcome = await confirmPaidCheckout(db, {
              id: checkout.id,
              payment_status: checkout.payment_status,
              metadata: checkout.metadata,
            });
            paid = outcome === "confirmed" || outcome === "already";
          }
        } catch {
          // Stripe unreachable: carry on, the webhook will confirm it.
        }
      }
      if (paid) redirect(`/events/${slug}/booked`);
      if (entry.holding && entry.heat_number) {
        heldHeat = entry.heat_number;
        heldSince = entry.created_at;
      }
    }
  }

  const heats = await getHeatAvailability(db, event);
  const closed = bookingClosedReason(event);
  const viewer: PickerViewer = !session
    ? "guest"
    : session.user.profileCompleted
      ? "ready"
      : "incomplete";

  const wanted = Number(sp.heat);
  const initialHeat = Number.isInteger(wanted) && wanted >= 1 && wanted <= heats.length ? wanted : null;
  const free = event.entry_fee_cents <= 0;
  const price = free ? "Free" : `${formatFee(event.entry_fee_cents)} AUD`;

  return (
    <>
      {/* Header */}
      <section className="relative bg-midnight text-white overflow-hidden">
        <Image
          src="/images/athlete-track-lane.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-[center_45%] opacity-25 motion-safe:animate-slow-zoom"
          aria-hidden
        />
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-b from-midnight/50 via-midnight/75 to-midnight"
        />
        <div className="relative mx-auto max-w-6xl px-6 pt-10 pb-10 md:pt-14 md:pb-12">
          <Link
            href={`/events/${slug}`}
            className="text-xs text-stone/60 hover:text-white transition-colors mb-8 inline-flex items-center min-h-11 font-mono uppercase tracking-[0.2em]"
          >
            &larr; Event details
          </Link>
          <div className="motion-safe:animate-fade-up">
            <p className="font-mono text-xs uppercase tracking-[0.25em] text-terracotta mb-4">
              {event.distance} · {event.location}
            </p>
            <h1 className="text-4xl md:text-6xl font-semibold tracking-tight leading-[1.02]">
              {event.name}
            </h1>
            <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 text-base text-stone/80">
              <span>{formatEventDate(event.date, "long")}</span>
              <span className="text-stone/30" aria-hidden>·</span>
              <span>{event.venue}</span>
              <span className="text-stone/30" aria-hidden>·</span>
              <span className="font-mono">{price}</span>
            </div>
            {event.description && (
              <p className="hidden md:block mt-5 max-w-2xl text-sm text-stone/60 leading-relaxed line-clamp-2">
                {event.description}
              </p>
            )}
          </div>
          <div className="mt-10 md:mt-12 max-w-2xl">
            <BookingSteps current={1} free={free} />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pt-10 md:pt-14 pb-0 lg:pb-20">
        <HeatPicker
          eventId={event.id}
          eventSlug={slug}
          eventName={event.name}
          entryFeeCents={event.entry_fee_cents}
          initialHeats={heats.map((h) => ({
            number: h.number,
            label: h.label,
            offsetMinutes: h.offsetMinutes,
            capacity: h.capacity,
            booked: h.booked,
            remaining: h.remaining,
            full: h.full,
            closed: h.closed,
            bookable: h.bookable,
          }))}
          initialHeat={initialHeat}
          heldHeat={heldHeat}
          heldSince={heldSince}
          viewer={viewer}
          closedReason={closed}
          closedKind={closedKind(event)}
          closedCta={closedCta(event)}
          timesConfirmed={isValidClock(event.first_heat_time)}
          intervalMinutes={event.heat_interval_minutes && event.heat_interval_minutes > 0 ? event.heat_interval_minutes : 15}
          changeFeeText={changeFeeText(event.change_fee_cents)}
          cancelled={sp.cancelled === "1"}
        />
      </section>
    </>
  );
}
