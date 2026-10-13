import Link from "next/link";
import Image from "next/image";
import { getDB } from "@/lib/db";
import LiveClock from "@/components/LiveClock";
import Countdown from "@/components/Countdown";
import RaceList from "@/components/RaceList";
import Sponsors from "@/components/Sponsors";
import Reveal from "@/components/Reveal";
import FirstInBand from "@/components/FirstInBand";
import { displayStatus, todayInMelbourne } from "@/lib/events";
import { formatEventDate, isDateTbc } from "@/lib/dates";
import {
  getHeatAvailability,
  hasHeats,
  heatWindow,
  type HeatAvailability,
} from "@/lib/heats";
import { bookingClosedReason, type BookableEvent } from "@/lib/bookings";
import { formatFee } from "@/lib/money";

export const dynamic = "force-dynamic";

const steps = [
  {
    title: "Book a heat",
    body: "Races are announced once they are locked in, on a track, a road, or anywhere a good race can be held. Pick your heat and you are on the start list.",
  },
  {
    title: "Run your race",
    body: "Small heats go off through the event window. Warm up, toe the line when your heat is called, and run against the clock.",
  },
  {
    title: "Your time, on the record",
    body: "Every finisher gets a time, a place, and their age group, posted to the event page and kept on their athlete profile.",
  },
  {
    title: "Paid on the day",
    body: "Every race pays prize money, handed out at the finish once the last runner is home. The purse is listed before you enter.",
  },
];

/** What the "Next event" band says and where its button goes. */
function describeSpotlight(
  event: BookableEvent,
  entered: number,
  heats: HeatAvailability[]
) {
  const open = bookingClosedReason(event) === null;
  const withHeats = hasHeats(event);
  // Open, but no heat left to book: each one is full or has already started.
  const noHeatLeft =
    withHeats && open && heats.length > 0 && heats.every((h) => !h.bookable);
  const bookable = open && !noHeatLeft;
  const cta =
    withHeats && bookable
      ? { href: `/events/${event.slug}/book`, label: "Book your heat" }
      : bookable
        ? { href: `/events/${event.slug}`, label: "Enter now" }
        : { href: `/events/${event.slug}`, label: "See the event" };
  const fullNote = noHeatLeft
    ? heats.every((h) => h.full)
      ? "Every heat is full right now. Spots can free up as unfinished checkouts expire."
      : "Every heat still to run is full. Spots can free up as unfinished checkouts expire."
    : null;
  const facts = [
    event.entry_fee_cents > 0
      ? `${formatFee(event.entry_fee_cents)} entry`
      : "Free entry",
    withHeats
      ? `${event.heat_count} heats${
          event.heat_interval_minutes ? `, every ${event.heat_interval_minutes} min` : ""
        }`
      : null,
    entered > 0 ? `${entered} ${withHeats ? "booked" : "entered"}` : null,
  ].filter((f): f is string => !!f);

  return {
    withHeats,
    tbc: isDateTbc(event.date),
    heatTimes: withHeats ? heatWindow(event) : null,
    cta,
    fullNote,
    facts,
  };
}

export default async function Home() {
  const db = await getDB();

  type EventRow = BookableEvent;

  // "Upcoming" means the event's date is today or later. This lets an event
  // automatically shift from upcoming to past without any manual status change.
  const upcomingEvents = await db
    .prepare("SELECT * FROM events WHERE date >= ? AND is_test = 0 ORDER BY date ASC")
    .bind(todayInMelbourne())
    .all() as unknown as { results: EventRow[] };

  const entryCounts = await db
    .prepare(
      "SELECT event_id, COUNT(*) as count FROM entries WHERE status = 'confirmed' GROUP BY event_id"
    )
    .all() as unknown as { results: { event_id: string; count: number }[] };

  const countMap = new Map(
    entryCounts.results.map((r: { event_id: string; count: number }) => [r.event_id, r.count])
  );

  // Soonest event taking bookings right now, or failing that the soonest
  // upcoming one (which may still be waiting on a date).
  const nextOpen =
    upcomingEvents.results.find((e) => bookingClosedReason(e) === null) ??
    upcomingEvents.results[0];

  // Live heat availability, only needed while the event is taking bookings.
  const spotlightHeats =
    nextOpen && hasHeats(nextOpen) && bookingClosedReason(nextOpen) === null
      ? await getHeatAvailability(db, nextOpen)
      : [];

  const spotlight = nextOpen
    ? describeSpotlight(nextOpen, countMap.get(nextOpen.id) ?? 0, spotlightHeats)
    : null;

  // The most recent race with times, so the home page celebrates real
  // finishers rather than describing them.
  const lastRace = await db
    .prepare(
      `SELECT ev.id, ev.slug, ev.name, ev.distance, ev.date, ev.venue
       FROM events ev
       WHERE ev.date < ? AND ev.is_test = 0
         AND EXISTS (SELECT 1 FROM results r WHERE r.event_id = ev.id)
       ORDER BY ev.date DESC LIMIT 1`
    )
    .bind(todayInMelbourne())
    .first<{ id: string; slug: string; name: string; distance: string; date: string; venue: string }>();

  const testRun = await db
    .prepare(
      `SELECT slug, name, date, venue FROM events
       WHERE is_test = 1 AND EXISTS (SELECT 1 FROM results r WHERE r.event_id = events.id)
       ORDER BY date DESC LIMIT 1`
    )
    .first<{ slug: string; name: string; date: string; venue: string }>();

  const finishers = lastRace
    ? ((await db
        .prepare(
          `SELECT r.rank, r.time_display, u.id as user_id, u.name
           FROM results r JOIN users u ON u.id = r.user_id
           WHERE r.event_id = ? ORDER BY r.rank ASC LIMIT 5`
        )
        .bind(lastRace.id)
        .all()) as unknown as {
        results: { rank: number; time_display: string; user_id: string; name: string }[];
      }).results
    : [];

  return (
    <>
      {/* Hero */}
      <section className="relative bg-midnight text-bone overflow-hidden min-h-[88svh] md:min-h-[94vh] flex items-end">
        {/* Phones: the photo fills the hero. Desktop: it takes the right
            side, like a magazine cover, so the type never sits on the runner. */}
        <div aria-hidden className="absolute inset-0 lg:left-[52%] overflow-hidden">
          <Image
            src="/images/athlete-track-lane.jpg"
            alt=""
            fill
            priority
            sizes="(min-width: 1024px) 48vw, 100vw"
            className="object-cover object-[42%_30%] opacity-75 lg:opacity-95 motion-safe:animate-slow-zoom"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-midnight via-midnight/40 to-midnight/0" />
          <div className="absolute inset-0 hidden lg:block bg-gradient-to-r from-midnight via-midnight/10 to-transparent w-1/3" />
        </div>
        <div aria-hidden className="absolute inset-0 lg:hidden bg-gradient-to-r from-midnight/70 via-midnight/20 to-transparent" />
        <div className="relative mx-auto max-w-6xl px-6 w-full pb-12 pt-40 md:pb-20">
          <div className="max-w-3xl lg:max-w-[48%] motion-safe:animate-fade-up">
            <p className="t-eyebrow text-bone/70">Worldwide time trials</p>
            <h1 className="t-display mt-5 text-[3.4rem] sm:text-[4.8rem] md:text-[6.2rem] lg:text-[clamp(4.4rem,5.6vw,6rem)]">
              You.
              <br />
              The clock.
              <br />
              <em className="text-bone/75">Nothing else.</em>
            </h1>
            <p className="t-lede mt-7 max-w-md text-bone/85">
              Time trials for people who love to run. Small heats, an honest
              clock, and real prize money at every race.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link href="/events" className="btn btn-primary btn-lg">
                Find a race
              </Link>
              <Link href="/format" className="btn btn-light btn-lg">
                How it works
              </Link>
            </div>
          </div>

          <div className="mt-14 md:mt-20 flex flex-col md:flex-row md:items-end md:justify-between gap-8 border-t rule-light pt-6 motion-safe:animate-fade-up [animation-delay:200ms]">
            <p className="t-caption text-bone/60 max-w-xs">
              Every race starts the same way. A line, a gun, and a clock that
              does not care who you are.
            </p>
            <LiveClock />
          </div>
        </div>
      </section>

      {/* Next race */}
      {nextOpen && spotlight && (
        <section className="bg-terracotta text-bone">
          <div className="mx-auto max-w-6xl px-6 py-14 md:py-20">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-end">
              <div className="lg:col-span-7">
                <p className="t-eyebrow text-bone/75">
                  Next race{nextOpen.distance ? `, ${nextOpen.distance}` : ""}
                </p>
                <h2 className="t-display mt-4 text-[2.8rem] md:text-[4.2rem]">
                  {nextOpen.name}
                </h2>
                <p className="t-lede mt-4 text-bone/90">
                  <em>
                    {spotlight.tbc ? "Date to be announced" : formatEventDate(nextOpen.date, "long")}
                  </em>
                  {!/TBC/i.test(nextOpen.venue) && <>, {nextOpen.venue}</>}
                </p>
                <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-[0.95rem] text-bone/85">
                  {spotlight.heatTimes && !spotlight.tbc && <li>Heats {spotlight.heatTimes}</li>}
                  {spotlight.facts.map((fact) => (
                    <li key={fact}>{fact}</li>
                  ))}
                </ul>
                {spotlight.fullNote && (
                  <p className="mt-5 max-w-md text-[0.95rem] text-bone/90 leading-relaxed">
                    {spotlight.fullNote}
                  </p>
                )}
                <div className="mt-8">
                  <Link
                    href={spotlight.cta.href}
                    className="btn btn-bone btn-lg"
                  >
                    {spotlight.cta.label}
                  </Link>
                </div>
              </div>

              <div className="lg:col-span-5 border-t border-bone/25 pt-8 lg:border-t-0 lg:pt-0 lg:border-l lg:pl-12">
                {spotlight.tbc ? (
                  <>
                    <p className="t-eyebrow text-bone/70">Bookings</p>
                    <p className="t-headline mt-3 text-[2rem] md:text-[2.4rem]">Opening soon.</p>
                    <p className="mt-3 text-[0.95rem] text-bone/85 leading-relaxed max-w-sm">
                      {spotlight.withHeats
                        ? "The date and heat times are being locked in. Set up your profile now and you will be one tap from booking a heat."
                        : "The date is being locked in. Set up your profile now and you will be one tap from entering."}
                    </p>
                    <Link href="/login" className="inline-block mt-5 link-quiet text-bone decoration-bone/40">
                      Set up your profile
                    </Link>
                  </>
                ) : (
                  <>
                    <p className="t-eyebrow text-bone/70 mb-4">
                      {spotlight.withHeats && nextOpen.first_heat_time ? "First heat in" : "Start gun in"}
                    </p>
                    <Countdown
                      target={nextOpen.date}
                      time={spotlight.withHeats ? nextOpen.first_heat_time : null}
                      className="text-bone"
                    />
                  </>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Why it exists */}
      <Reveal>
        <section className="bg-bone">
          <div className="mx-auto max-w-6xl px-6 py-24 md:py-36">
            <div className="max-w-4xl">
              <p className="t-eyebrow text-dust">What Running TT is</p>
              <p className="t-headline mt-6 text-[1.9rem] sm:text-[2.4rem] md:text-[3.1rem] text-midnight">
                A start line, a clock, and a purse worth racing for.{" "}
                <em className="text-terracotta">Open to every runner who wants to race.</em>
              </p>
              <p className="mt-8 max-w-xl text-[1.05rem] leading-relaxed text-midnight/70">
                Book a heat, run your best, and your time goes on the record.
                The fastest times take home prize money, backed by brands who
                want to support people who run.
              </p>
            </div>
          </div>
        </section>
      </Reveal>

      <FirstInBand
        tone="ink"
        spots={
          nextOpen && hasHeats(nextOpen) && nextOpen.heat_capacity
            ? (nextOpen.heat_count ?? 0) * nextOpen.heat_capacity
            : null
        }
        heats={nextOpen && hasHeats(nextOpen) ? nextOpen.heat_count : null}
        href={nextOpen ? (spotlight?.cta.href ?? `/events/${nextOpen.slug}`) : "/events"}
        linkLabel={nextOpen && spotlight?.cta.label === "Book your heat" ? "Book your heat" : "See the races"}
      />

      {/* Races */}
      <Reveal>
        <section className="bg-bone">
          <div className="mx-auto max-w-6xl px-6 py-24 md:py-32">
            <div className="flex flex-wrap items-end justify-between gap-4 mb-10 md:mb-14">
              <h2 className="t-display text-[2.8rem] md:text-[4.2rem]">Upcoming races</h2>
              <Link href="/events" className="link-quiet text-midnight text-[0.95rem]">
                All races
              </Link>
            </div>
            {upcomingEvents.results.length > 0 ? (
              <RaceList
                races={upcomingEvents.results.map((event) => ({
                  slug: event.slug,
                  name: event.name,
                  distance: event.distance,
                  date: event.date,
                  venue: event.venue,
                  location: event.location,
                  status: displayStatus(event.status, event.date),
                  entryFeeCents: event.entry_fee_cents,
                  entered: countMap.get(event.id) ?? 0,
                }))}
              />
            ) : (
              <div className="border-y rule py-14">
                <h3 className="t-headline text-[1.8rem] md:text-[2.2rem]">The next race is being locked in.</h3>
                <p className="mt-3 max-w-md text-midnight/65 leading-relaxed">
                  Races are announced as venues are confirmed. Set up your
                  athlete profile now and you will be ready the moment
                  bookings open.
                </p>
                <Link href="/login" className="btn btn-primary mt-7">
                  Set up your profile
                </Link>
              </div>
            )}
            {testRun && (
              <p className="t-caption mt-8 text-midnight/55">
                Test run: {testRun.name}, {formatEventDate(testRun.date, "medium")}.{" "}
                <Link href={`/events/${testRun.slug}`} className="link-quiet not-italic text-midnight/70">
                  See the times
                </Link>
              </p>
            )}
          </div>
        </section>
      </Reveal>

      {/* Recent finishers */}
      {lastRace && finishers.length > 0 && (
        <Reveal>
          <section className="bg-midnight text-bone">
            <div className="mx-auto max-w-6xl px-6 py-24 md:py-32">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                <div className="lg:col-span-5">
                  <p className="t-eyebrow text-bone/60">On the clock</p>
                  <h2 className="t-display mt-5 text-[2.6rem] md:text-[3.8rem]">
                    {lastRace.name}
                  </h2>
                  <p className="t-lede mt-4 text-bone/75">
                    <em>{formatEventDate(lastRace.date, "long")}</em>
                    {!/TBC/i.test(lastRace.venue) && <>, {lastRace.venue}</>}
                  </p>
                  <p className="mt-6 max-w-sm text-bone/70 leading-relaxed">
                    Thank you to everyone who lined up. These are the runners
                    who led the way home.
                  </p>
                  <Link
                    href={`/events/${lastRace.slug}`}
                    className="inline-block mt-6 link-quiet text-bone decoration-bone/40"
                  >
                    Full results
                  </Link>
                </div>
                <ol className="lg:col-span-7 border-t rule-light">
                  {finishers.map((f) => (
                    <li key={f.user_id} className="border-b rule-light">
                      <Link
                        href={`/athletes/${f.user_id}`}
                        className="group grid grid-cols-[3rem_1fr_auto] items-baseline gap-4 py-5"
                      >
                        <span className={`t-numeral text-2xl ${f.rank === 1 ? "text-gold" : "text-bone/45"}`}>
                          {f.rank}
                        </span>
                        <span className="t-headline text-[1.4rem] md:text-[1.7rem] truncate group-hover:text-terracotta transition-colors duration-300">
                          {f.name}
                        </span>
                        <span className="t-numeral text-[1.8rem] md:text-[2.2rem]">{f.time_display}</span>
                      </Link>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </section>
        </Reveal>
      )}

      {/* How it works */}
      <Reveal>
        <section className="bg-stone">
          <div className="mx-auto max-w-6xl px-6 py-24 md:py-32">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
              <div className="lg:col-span-4">
                <h2 className="t-display text-[2.8rem] md:text-[3.8rem]">
                  How a race works
                </h2>
                <Link href="/format" className="inline-block mt-6 link-quiet text-midnight">
                  The full format
                </Link>
              </div>
              <ol className="lg:col-span-8 border-t border-midnight/15">
                {steps.map((step, i) => (
                  <li
                    key={step.title}
                    className="grid grid-cols-[2.5rem_1fr] md:grid-cols-[4rem_1fr] gap-4 border-b border-midnight/15 py-7"
                  >
                    <span className="t-numeral text-[1.6rem] text-terracotta">{i + 1}</span>
                    <div>
                      <h3 className="text-[1.45rem] md:text-[1.6rem] leading-tight">{step.title}</h3>
                      <p className="mt-2 max-w-xl text-midnight/70 leading-relaxed">{step.body}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>
      </Reveal>

      {/* Prize money */}
      <Reveal>
        <section className="bg-midnight text-bone">
          <div className="mx-auto max-w-6xl px-6 py-24 md:py-32">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-end">
              <div className="lg:col-span-7">
                <h2 className="t-display text-[3rem] md:text-[4.8rem]">
                  Prize money.
                  <br />
                  <em className="text-gold">Always.</em>
                </h2>
              </div>
              <div className="lg:col-span-5 space-y-4 text-bone/75 leading-relaxed">
                <p>
                  Every Running TT race pays out. No qualifying standards and
                  no fine print: you show up, you race, and fast running gets
                  rewarded.
                </p>
                <p>
                  The purse and how it splits is listed on each race before
                  you enter, and it is handed out at the finish. It comes from
                  entry fees and from sponsors who back the runners.
                </p>
              </div>
            </div>
          </div>
        </section>
      </Reveal>

      <Sponsors />
    </>
  );
}
