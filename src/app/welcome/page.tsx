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
import { OCCUPYING_SQL, getHeatAvailability, hasHeats, heatWindow } from "@/lib/heats";
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
    // A heat counts only if it has space and has not started yet.
    const heats = await getHeatAvailability(db, event);
    return heats.some((h) => h.bookable);
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
    <section className="bg-bone lg:grid lg:grid-cols-12 lg:min-h-[calc(100svh-4rem)]">
      {/* The welcome. A band above the steps on phones, the left page of a
          spread on desktop, held in place while the steps change. */}
      <div className="relative lg:col-span-5 bg-midnight text-bone overflow-hidden flex items-end min-h-[13rem] sm:min-h-[18rem] lg:min-h-0 lg:sticky lg:top-16 lg:self-start lg:h-[calc(100svh-4rem)]">
        <Image
          src="/images/athlete-track-side.jpg"
          alt=""
          fill
          priority
          sizes="(min-width: 1024px) 42vw, 100vw"
          className="object-cover object-[50%_30%] opacity-75 motion-safe:animate-slow-zoom"
          aria-hidden
        />
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-t from-midnight via-midnight/35 to-midnight/0"
        />
        <div className="relative w-full px-6 pt-16 pb-7 lg:px-12 lg:pb-14 motion-safe:animate-fade-up">
          <p className="t-display text-[2.5rem] sm:text-[3.2rem] lg:text-[4.2rem]">
            Good to <em className="text-bone/75">have you.</em>
          </p>
          <p className="t-caption mt-4 max-w-xs text-bone/65">
            A few quick questions and your athlete page is ready. Every race
            you run with us is kept on it.
          </p>
        </div>
      </div>

      <div className="lg:col-span-7 lg:flex lg:items-center">
        <div className="w-full max-w-lg mx-auto px-6 pt-10 pb-16 md:pt-14 lg:py-24">
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
      </div>
    </section>
  );
}
