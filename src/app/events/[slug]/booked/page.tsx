import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getDB } from "@/lib/db";
import { getSession } from "@/lib/auth";
import {
  EVENT_BOOKING_COLUMNS,
  bookingRef,
  changeFeeText,
  confirmPaidCheckout,
  type BookableEvent,
} from "@/lib/bookings";
import { formatEventDate, isDateTbc } from "@/lib/dates";
import { todayInMelbourne } from "@/lib/events";
import { buildHeats, getHeatAvailability, hasHeats } from "@/lib/heats";
import { formatFee } from "@/lib/money";
import { retrieveCheckoutSession } from "@/lib/stripe";
import BookingTicket, { BookingSteps } from "@/components/BookingTicket";
import HeatChangeRequest from "@/components/HeatChangeRequest";
import PaymentPending from "@/components/PaymentPending";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your booking · Running TT",
  robots: { index: false, follow: false },
};

interface EntryRow {
  id: string;
  status: string;
  heat_number: number | null;
  /** Set only when the athlete paid online. Entries added by the team have none. */
  stripe_payment_id: string | null;
  confirmation_sent_at: string | null;
}

export default async function BookedPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const db = await getDB();

  const event = await db
    .prepare(`SELECT ${EVENT_BOOKING_COLUMNS} FROM events WHERE slug = ?`)
    .bind(slug)
    .first<BookableEvent>();
  if (!event) notFound();

  const session = await getSession(db);
  if (!session) redirect(`/login?next=${encodeURIComponent(`/events/${slug}/booked`)}`);

  const loadEntry = () =>
    db
      .prepare(
        `SELECT id, status, heat_number, stripe_payment_id, confirmation_sent_at
         FROM entries WHERE event_id = ? AND user_id = ?`
      )
      .bind(event.id, session.user.id)
      .first<EntryRow>();

  let entry = await loadEntry();

  // Back from Stripe before the webhook has landed: confirm from the
  // checkout itself, but only if it belongs to whoever is signed in.
  const checkoutId = typeof sp.session_id === "string" ? sp.session_id : "";
  if (checkoutId && entry?.status === "pending") {
    try {
      const checkout = await retrieveCheckoutSession(checkoutId);
      if (checkout.metadata?.user_id === session.user.id) {
        await confirmPaidCheckout(db, {
          id: checkout.id,
          payment_status: checkout.payment_status,
          metadata: checkout.metadata,
        });
        entry = await loadEntry();
      }
    } catch {
      // Unknown or unreachable checkout: the webhook will confirm it.
    }
  }

  const withHeats = hasHeats(event);
  if (!entry) redirect(withHeats ? `/events/${slug}/book` : `/events/${slug}`);

  const free = event.entry_fee_cents <= 0;
  const confirmed = entry.status === "confirmed";
  const heat = entry.heat_number
    ? buildHeats(event).find((h) => h.number === entry.heat_number) ?? null
    : null;

  // "$15 AUD, paid" only when Stripe took the money. Entries added by the
  // team were never paid online.
  const entryText = free
    ? "Free entry"
    : entry.stripe_payment_id
      ? `${formatFee(event.entry_fee_cents)} AUD, paid`
      : "Entered by Running TT";

  // Heat changes are only for a race that is still ahead (race day included).
  const eventAhead = isDateTbc(event.date) || event.date >= todayInMelbourne();

  let changeSection: React.ReactNode = null;
  if (confirmed && withHeats && eventAhead) {
    const [availability, openRequest] = await Promise.all([
      getHeatAvailability(db, event),
      db
        .prepare("SELECT id FROM heat_change_requests WHERE entry_id = ? AND status = 'open'")
        .bind(entry.id)
        .first(),
    ]);
    changeSection = (
      <HeatChangeRequest
        entryId={entry.id}
        currentHeat={entry.heat_number}
        heats={availability
          .filter((h) => !h.closed)
          .map((h) => ({ number: h.number, label: h.label, full: h.full }))}
        changeFeeText={changeFeeText(event.change_fee_cents)}
        hasOpenRequest={!!openRequest}
      />
    );
  }

  return (
    <>
      {/* Header */}
      <section className="relative bg-midnight text-bone overflow-hidden">
        <Image
          src="/images/athlete-track-side.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-[center_40%] opacity-25 motion-safe:animate-slow-zoom"
          aria-hidden
        />
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-b from-midnight/50 via-midnight/75 to-midnight"
        />
        <div className="relative mx-auto max-w-3xl px-6 pt-8 pb-10 md:pt-12 md:pb-14">
          <Link
            href={`/events/${slug}`}
            className="inline-flex min-h-11 items-center text-[0.9rem] text-bone/60 hover:text-bone transition-colors"
          >
            <span className="link-draw">Event details</span>
          </Link>
          <div className="mt-8 md:mt-10">
            <p className="t-eyebrow text-bone/60">
              {event.distance} · {event.location}
            </p>
            <p className="t-headline mt-3 text-[1.9rem] md:text-[2.6rem]">{event.name}</p>
          </div>
          <div className="mt-10 md:mt-12">
            <BookingSteps current={confirmed ? 3 : 2} free={free} withHeats={withHeats} />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-6 py-14 md:py-20 space-y-16 md:space-y-20">
        {confirmed ? (
          <>
            <BookingTicket
              entryId={entry.id}
              bookingRef={bookingRef(entry.id)}
              athleteName={session.user.name}
              email={session.user.email}
              eventSlug={slug}
              eventName={event.name}
              distance={event.distance}
              date={event.date}
              dateText={formatEventDate(event.date, "long")}
              venue={event.venue}
              location={event.location}
              heatNumber={entry.heat_number}
              heatLabel={heat?.label ?? null}
              heatStart={heat?.startTime ?? null}
              entryText={entryText}
              emailed={!!entry.confirmation_sent_at}
            />
            {changeSection}
          </>
        ) : checkoutId ? (
          <PaymentPending eventHref={`/events/${slug}`} />
        ) : (
          <div className="motion-safe:animate-fade-up">
            <h1 className="t-display text-[2.5rem] md:text-[3.6rem]">
              Your booking is not <em>finished.</em>
            </h1>
            <p className="mt-5 text-[1.05rem] text-midnight/65 leading-relaxed max-w-lg">
              {heat
                ? `You started booking Heat ${heat.number}, but the payment did not go through. Pick up where you left off and your spot is yours.`
                : "The payment did not go through. Pick up where you left off and your spot is yours."}
            </p>
            <Link
              href={
                withHeats
                  ? `/events/${slug}/book${heat ? `?heat=${heat.number}` : ""}`
                  : `/events/${slug}`
              }
              className="btn btn-primary btn-lg mt-8"
            >
              Finish booking
            </Link>
          </div>
        )}
      </section>
    </>
  );
}
