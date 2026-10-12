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
import { formatEventDate } from "@/lib/dates";
import { buildHeats, getHeatAvailability, hasHeats } from "@/lib/heats";
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
      .prepare("SELECT id, status, heat_number FROM entries WHERE event_id = ? AND user_id = ?")
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

  let changeSection: React.ReactNode = null;
  if (confirmed && withHeats) {
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
        heats={availability.map((h) => ({ number: h.number, label: h.label, full: h.full }))}
        changeFeeText={changeFeeText(event.change_fee_cents)}
        hasOpenRequest={!!openRequest}
      />
    );
  }

  return (
    <>
      {/* Header */}
      <section className="relative bg-midnight text-white overflow-hidden">
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
        <div className="relative mx-auto max-w-3xl px-6 pt-10 pb-10 md:pt-14 md:pb-12">
          <Link
            href={`/events/${slug}`}
            className="text-xs text-stone/60 hover:text-white transition-colors mb-6 inline-flex items-center min-h-11 font-mono uppercase tracking-[0.2em]"
          >
            &larr; Event details
          </Link>
          <p className="font-mono text-xs uppercase tracking-[0.25em] text-terracotta mb-3">
            {event.distance} · {event.location}
          </p>
          <p className="text-2xl md:text-3xl font-semibold tracking-tight">{event.name}</p>
          <div className="mt-8 md:mt-10">
            <BookingSteps current={confirmed ? 3 : 2} free={free} withHeats={withHeats} />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-6 py-12 md:py-16 space-y-10 md:space-y-12">
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
              entryText={
                free
                  ? "Free entry"
                  : `$${(event.entry_fee_cents / 100).toFixed(event.entry_fee_cents % 100 ? 2 : 0)} AUD, paid`
              }
            />
            {changeSection}
          </>
        ) : checkoutId ? (
          <PaymentPending eventHref={`/events/${slug}`} />
        ) : (
          <div className="bg-white border border-stone/40 p-7 md:p-10 motion-safe:animate-fade-up">
            <p className="font-mono text-xs uppercase tracking-[0.25em] text-dust mb-3">
              Not paid yet
            </p>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
              Your booking is not finished
            </h1>
            <p className="mt-3 text-midnight/60 leading-relaxed max-w-lg">
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
              className="mt-7 inline-flex items-center justify-center bg-terracotta text-white text-sm font-medium px-7 py-3.5 min-h-12 hover:bg-terracotta/90 transition-colors"
            >
              Finish booking
            </Link>
          </div>
        )}
      </section>
    </>
  );
}
