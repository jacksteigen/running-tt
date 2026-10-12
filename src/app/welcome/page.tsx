import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import { getDB } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { todayInMelbourne } from "@/lib/events";
import { safeNextPath } from "@/lib/site";
import {
  EVENT_BOOKING_COLUMNS,
  bookingClosedReason,
  type BookableEvent,
} from "@/lib/bookings";
import { OCCUPYING_SQL, hasHeats, heatWindow } from "@/lib/heats";
import { DATE_TBC } from "@/lib/dates";
import Onboarding from "@/components/Onboarding";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Set up your profile · Running TT",
  robots: { index: false, follow: false },
};

/** Whether an event still has a spot for one more athlete. */
async function hasSpace(db: D1Database, event: BookableEvent): Promise<boolean> {
  if (hasHeats(event)) {
    const capacity = (event.heat_count ?? 0) * (event.heat_capacity && event.heat_capacity > 0 ? event.heat_capacity : 10);
    const taken = await db
      .prepare(
        `SELECT COUNT(*) as n FROM entries
         WHERE event_id = ? AND heat_number IS NOT NULL AND ${OCCUPYING_SQL}`
      )
      .bind(event.id)
      .first<{ n: number }>();
    return (taken?.n ?? 0) < capacity;
  }
  if (!event.max_entries) return true;
  const taken = await db
    .prepare(`SELECT COUNT(*) as n FROM entries WHERE event_id = ? AND ${OCCUPYING_SQL}`)
    .bind(event.id)
    .first<{ n: number }>();
  return (taken?.n ?? 0) < event.max_entries;
}

export default async function WelcomePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const sp = await searchParams;
  const next = safeNextPath(sp.next);
  const db = await getDB();
  const session = await getSession(db);

  if (!session) redirect(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  if (session.user.profileCompleted) redirect(next ?? "/dashboard");

  const { user } = session;

  // The soonest event taking bookings right now, offered as the final step.
  // Skipped when the athlete is already part way through booking (`next`).
  let offer: BookableEvent | null = null;
  if (!next) {
    const candidates = (await db
      .prepare(
        `SELECT ${EVENT_BOOKING_COLUMNS}
         FROM events
         WHERE status = 'Open' AND date >= ? AND date < ?
         ORDER BY date ASC LIMIT 5`
      )
      .bind(todayInMelbourne(), DATE_TBC)
      .all()) as unknown as { results: BookableEvent[] };

    for (const event of candidates.results) {
      if (bookingClosedReason(event) !== null) continue;
      const booked = await db
        .prepare(
          "SELECT id FROM entries WHERE event_id = ? AND user_id = ? AND status = 'confirmed'"
        )
        .bind(event.id, user.id)
        .first();
      if (booked) continue;
      if (!(await hasSpace(db, event))) continue;
      offer = event;
      break;
    }
  }

  const withHeats = !!offer && hasHeats(offer);
  const heatTimes = offer && withHeats ? heatWindow(offer) : null;

  return (
    <section className="relative min-h-[calc(100vh-64px)] bg-midnight text-white overflow-hidden">
      <Image
        src="/images/athlete-track-side.jpg"
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover object-center opacity-40 scale-105 motion-safe:animate-slow-zoom"
        aria-hidden
      />
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-b from-midnight/70 via-midnight/60 to-midnight"
      />
      <div className="relative mx-auto max-w-xl px-6 py-12 md:py-20">
        <Onboarding
          next={next}
          initial={{
            firstName: user.firstName ?? "",
            middleName: user.middleName ?? "",
            lastName: user.lastName ?? "",
            dateOfBirth: user.dateOfBirth ?? "",
            city: user.city ?? "",
            country: user.country ?? "",
            bio: user.bio ?? "",
          }}
          openEvent={
            offer
              ? {
                  id: offer.id,
                  slug: offer.slug,
                  name: offer.name,
                  distance: offer.distance,
                  date: offer.date,
                  time: offer.time,
                  venue: offer.venue,
                  entryFeeCents: offer.entry_fee_cents,
                  hasHeats: withHeats,
                  heatSummary: withHeats
                    ? [`${offer.heat_count} heats`, heatTimes].filter(Boolean).join(" · ")
                    : null,
                }
              : null
          }
        />
      </div>
    </section>
  );
}
