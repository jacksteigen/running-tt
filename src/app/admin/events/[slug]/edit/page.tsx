import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getDB } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { isStripeTestMode } from "@/lib/stripe";
import { displayStatus } from "@/lib/events";
import { formatEventDate, isDateTbc } from "@/lib/dates";
import { getHeatAvailability, hasHeats, type HeatConfig } from "@/lib/heats";
import { EVENT_STATUSES } from "@/lib/eventInput";
import { parsePrizes } from "@/lib/racetime";
import EventEditor, { type EventStatus } from "@/components/EventEditor";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Edit event · Admin · Running TT",
  robots: { index: false, follow: false },
};

interface EventRow extends HeatConfig {
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
  change_fee_cents: number | null;
  description: string | null;
  check_in: string | null;
  what_to_bring: string | null;
  prizes: string | null;
}

function parseList(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

export default async function EditEventPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const db = await getDB();
  const session = await getSession(db);

  if (!session) redirect("/login");
  if (!session.user.isAdmin) redirect("/dashboard");

  const event = await db
    .prepare("SELECT * FROM events WHERE slug = ?")
    .bind(slug)
    .first<EventRow>();

  if (!event) notFound();

  const usage = await db
    .prepare(
      `SELECT
         (SELECT COUNT(*) FROM entries WHERE event_id = ? AND status IN ('confirmed', 'pending')) as booked,
         (SELECT COUNT(*) FROM entries WHERE event_id = ?) as entries,
         (SELECT COUNT(*) FROM results WHERE event_id = ?) as results`
    )
    .bind(event.id, event.id, event.id)
    .first<{ booked: number; entries: number; results: number }>();

  const heats = hasHeats(event) ? await getHeatAvailability(db, event) : [];
  const heatBooked = Object.fromEntries(heats.map((h) => [h.number, h.booked]));

  const stripeTestMode = await isStripeTestMode();
  const tbc = isDateTbc(event.date);
  const withHeats = hasHeats(event);
  const status: EventStatus = (EVENT_STATUSES as readonly string[]).includes(event.status)
    ? (event.status as EventStatus)
    : "Coming Soon";
  const bookedCount = usage?.booked ?? 0;

  return (
    <>
      <section className="bg-midnight text-white">
        <div className="mx-auto max-w-6xl px-6 py-10 md:py-14">
          <Link
            href={`/admin/events/${event.slug}`}
            className="text-xs text-stone/60 hover:text-stone/80 transition-colors mb-4 inline-block"
          >
            &larr; Manage event
          </Link>
          <p className="font-mono text-xs uppercase tracking-[0.25em] text-terracotta mb-2">
            {event.distance} · Edit event
          </p>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">{event.name}</h1>
          <p className="mt-2 text-stone/70 text-sm">
            {formatEventDate(event.date, "long")} · {displayStatus(event.status, event.date)} ·{" "}
            {bookedCount} booked
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href={`/events/${event.slug}`}
              className="text-xs font-medium text-white border border-white/20 px-4 py-2 hover:border-white/50 transition-colors"
            >
              Public page
            </Link>
          </div>
        </div>
      </section>

      <EventEditor
        mode="edit"
        eventId={event.id}
        slug={event.slug}
        bookedCount={bookedCount}
        heatBooked={heatBooked}
        canDelete={(usage?.entries ?? 0) === 0 && (usage?.results ?? 0) === 0}
        stripeTestMode={stripeTestMode}
        initial={{
          name: event.name,
          distance: event.distance,
          dateTbc: tbc,
          date: tbc ? "" : event.date,
          // The server writes these placeholders for blanks; show them as blanks.
          venue: event.venue === "Venue TBC" ? "" : event.venue,
          location: event.location === "Location TBC" ? "" : event.location,
          status,
          entryFee: (event.entry_fee_cents ?? 0) / 100,
          changeFee: event.change_fee_cents === null ? null : event.change_fee_cents / 100,
          startTime: withHeats || event.time === "Time TBC" ? "" : event.time,
          heatsEnabled: withHeats,
          firstHeatTime: event.first_heat_time ?? "",
          heatIntervalMinutes: event.heat_interval_minutes || 15,
          heatCount: event.heat_count || 12,
          heatCapacity: event.heat_capacity || 10,
          prizes: parsePrizes(event.prizes),
          description: event.description ?? "",
          checkIn: event.check_in ?? "",
          whatToBring: parseList(event.what_to_bring),
        }}
      />
    </>
  );
}
