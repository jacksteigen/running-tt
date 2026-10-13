import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getDB } from "@/lib/db";
import EventCard from "@/components/EventCard";
import GlobeMap from "@/components/GlobeMap";
import RaceList from "@/components/RaceList";
import FirstInBand from "@/components/FirstInBand";
import { displayStatus, todayInMelbourne } from "@/lib/events";
import { parsePrizes } from "@/lib/racetime";
import { purseCents, toPrizeSplit } from "@/lib/categories";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Events · Running TT",
  description:
    "Upcoming and past Running TT time trial events, held on certified tracks and road courses worldwide.",
};

interface EventRow {
  id: string;
  slug: string;
  name: string;
  distance: string;
  date: string;
  time: string;
  location: string;
  venue: string;
  status: string;
  entry_fee_cents: number;
  is_test: number;
  prizes: string | null;
  prize_split: string | null;
}

export default async function EventsPage() {
  const db = await getDB();

  const allEvents = await db
    .prepare("SELECT * FROM events ORDER BY date ASC")
    .all() as unknown as { results: EventRow[] };

  // Upcoming/past split by date, not status, so events flip automatically once
  // their date has passed. Past events are reversed so the most recent shows first.
  // Event dates are Melbourne calendar days, as everywhere else.
  const todayISO = todayInMelbourne();
  // Test runs stay out of the public fixture list; their pages still work by link.
  const upcoming = allEvents.results.filter((e) => e.date >= todayISO && !e.is_test);
  const past = allEvents.results
    .filter((e) => e.date < todayISO)
    .reverse();

  // Get entry counts
  const entryCounts = await db
    .prepare(
      "SELECT event_id, COUNT(*) as count FROM entries WHERE status = 'confirmed' GROUP BY event_id"
    )
    .all() as unknown as { results: { event_id: string; count: number }[] };

  const countMap = new Map(
    entryCounts.results.map((r: { event_id: string; count: number }) => [r.event_id, r.count])
  );

  return (
    <>
      <section className="bg-bone">
        <div className="mx-auto max-w-6xl px-6 pt-16 pb-24 md:pt-24 md:pb-32">
          {/* On phones the race list comes first, so the photo only joins
              the header once there is room beside the title. */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-7 lg:gap-12 items-end motion-safe:animate-fade-up">
            <div className="lg:col-span-7">
              <h1 className="t-display text-[3.4rem] sm:text-[4.4rem] md:text-[5.6rem]">
                Find your <em>race.</em>
              </h1>
              <p className="t-lede mt-7 lg:mt-9 max-w-md text-midnight/75">
                Time trials held around the world, wherever there is a good
                venue and runners who want to race. Small heats, an honest
                clock, and prize money at every one.
              </p>
            </div>
            <div className="hidden lg:block lg:col-span-4 lg:col-start-9 relative aspect-[4/5] overflow-hidden bg-midnight/5">
              <Image
                src="/images/road-race.webp"
                alt="A runner leading a group along a city road race"
                fill
                sizes="22rem"
                className="object-cover object-[45%_40%]"
              />
            </div>
          </div>

          <div className="mt-16 md:mt-24">
            {upcoming.length > 0 ? (
              <>
                <div className="flex items-baseline justify-between gap-4 mb-5">
                  <h2 className="t-headline text-[1.7rem] md:text-[2.1rem]">Coming up</h2>
                  <p className="t-eyebrow text-dust">
                    {upcoming.length} {upcoming.length === 1 ? "race" : "races"}
                  </p>
                </div>
                <RaceList
                  races={upcoming.map((event) => ({
                    slug: event.slug,
                    name: event.name,
                    distance: event.distance,
                    date: event.date,
                    venue: event.venue,
                    location: event.location,
                    status: displayStatus(event.status, event.date),
                    entryFeeCents: event.entry_fee_cents,
                    prizeCents: purseCents(parsePrizes(event.prizes), toPrizeSplit(event.prize_split)),
                    entered: countMap.get(event.id) ?? 0,
                  }))}
                />
                {past.length === 0 && (
                  <p className="mt-8 t-caption text-midnight/55">
                    No past races yet. The first one is coming.
                  </p>
                )}
              </>
            ) : past.length === 0 ? (
              <div className="border-y rule py-14">
                <h2 className="t-headline text-[1.8rem] md:text-[2.2rem]">
                  The first race is being locked in.
                </h2>
                <p className="mt-3 max-w-md text-midnight/65 leading-relaxed">
                  Races are announced as venues are confirmed, anywhere in the
                  world. Create your athlete profile now and you&apos;ll be
                  ready the moment entries open.
                </p>
                <Link href="/login" className="btn btn-primary mt-7">
                  Create your profile
                </Link>
              </div>
            ) : (
              <div className="border-y rule py-10">
                <h2 className="t-headline text-[1.6rem] md:text-[2rem]">
                  The next race is being locked in.
                </h2>
                <p className="mt-3 max-w-md text-midnight/65 leading-relaxed">
                  Races are announced as venues are confirmed. Set up your
                  athlete profile and you will be ready the moment bookings
                  open.
                </p>
                <Link href="/login" className="inline-block mt-5 link-quiet text-midnight">
                  Set up your profile
                </Link>
              </div>
            )}
          </div>
        </div>
      </section>

      <FirstInBand tone="ink" href={upcoming.length > 0 ? `/events/${upcoming[0].slug}` : null} linkLabel="See the next race" />

      {past.length > 0 && (
        <section className="bg-stone">
          <div className="mx-auto max-w-6xl px-6 py-24 md:py-32">
            <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-4 mb-10 md:mb-14">
              <h2 className="t-display text-[2.6rem] md:text-[3.6rem]">
                Past <em>races</em>
              </h2>
              <p className="t-caption text-midnight/60 max-w-xs">
                {past.length} {past.length === 1 ? "race" : "races"} run so far.
                Thank you to everyone who lined up.
              </p>
            </div>
            <ol className="border-t rule">
              {past.map((event) => (
                <li key={event.id} className="border-b rule">
                  <EventCard
                    slug={event.slug}
                    name={event.name}
                    distance={event.distance}
                    date={event.date}
                    location={event.location}
                    venue={event.venue}
                    status={event.is_test ? "Test run" : displayStatus(event.status, event.date)}
                    entryCount={countMap.get(event.id) ?? 0}
                  />
                </li>
              ))}
            </ol>
          </div>
        </section>
      )}

      <GlobeMap />
    </>
  );
}
