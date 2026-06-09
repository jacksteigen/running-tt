import Link from "next/link";
import Image from "next/image";
import { getDB } from "@/lib/db";
import LiveClock from "@/components/LiveClock";
import Countdown from "@/components/Countdown";
import EventCard from "@/components/EventCard";
import Sponsors from "@/components/Sponsors";
import { displayStatus } from "@/lib/events";

export const dynamic = "force-dynamic";

const stats = [
  { value: "320", label: "athletes" },
  { value: "4", label: "events run" },
  { value: "2", label: "cities" },
  { value: "$14,000", label: "in prize money awarded" },
];

const steps = [
  {
    number: "01",
    title: "Book a race",
    description:
      "Races are announced when they're locked in. Tracks, road courses, anywhere a good race can be held.",
  },
  {
    number: "02",
    title: "Rolling heats",
    description:
      "Runners go off in small heats across the event window. Show up, warm up, race when your number is called.",
  },
  {
    number: "03",
    title: "Times posted",
    description:
      "Every time gets recorded at the finish and posted to the event page. Your run lives there afterwards.",
  },
  {
    number: "04",
    title: "Prize money for top 3",
    description:
      "1st takes $2,000. 2nd takes $1,000. 3rd takes $500. Every event, no exceptions.",
  },
];

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default async function Home() {
  const db = await getDB();

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
  }

  // "Upcoming" means the event's date is today or later. This lets an event
  // automatically shift from upcoming to past without any manual status change.
  const upcomingEvents = await db
    .prepare(
      "SELECT * FROM events WHERE date >= date('now') ORDER BY date ASC"
    )
    .all() as unknown as { results: EventRow[] };

  const entryCounts = await db
    .prepare(
      "SELECT event_id, COUNT(*) as count FROM entries WHERE status = 'confirmed' GROUP BY event_id"
    )
    .all() as unknown as { results: { event_id: string; count: number }[] };

  const countMap = new Map(
    entryCounts.results.map((r: { event_id: string; count: number }) => [r.event_id, r.count])
  );

  // Soonest event with Open entries, or failing that the soonest upcoming.
  const nextOpen =
    upcomingEvents.results.find((e) => e.status === "Open") ??
    upcomingEvents.results[0];

  return (
    <>
      {/* Hero */}
      <section className="bg-midnight text-white relative overflow-hidden">
        {/* subtle track-line decoration */}
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(90deg, transparent 0 79px, #F5F2EC 79px 80px)",
          }}
        />
        <div className="mx-auto max-w-6xl px-6 py-20 md:py-28 relative">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <div>
              <div className="mb-7">
                <p className="font-mono text-xs uppercase tracking-[0.25em] text-terracotta">
                  Running TT
                </p>
                <p className="font-mono text-xs uppercase tracking-[0.25em] text-stone/50 mt-1.5">
                  Worldwide time trials
                </p>
              </div>
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-semibold tracking-tight leading-[1.05]">
                You. The clock.
                <br />
                <span className="text-stone/60">Nothing else.</span>
              </h1>
              <p className="mt-6 text-lg text-stone/70 max-w-lg leading-relaxed">
                Time trial events held around the world. Rolling heats and
                real prize money at every race.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  href="/events"
                  className="inline-block bg-terracotta text-white font-medium px-7 py-3.5 text-sm hover:bg-terracotta/90 transition-colors"
                >
                  Find an event
                </Link>
                <Link
                  href="/format"
                  className="inline-block border border-stone/20 text-white px-7 py-3.5 text-sm hover:border-stone/40 transition-colors"
                >
                  How it works
                </Link>
              </div>
            </div>

            {/* Live clock */}
            <div className="lg:pl-8 lg:border-l lg:border-stone/10">
              <p className="font-mono text-xs uppercase tracking-[0.25em] text-stone/40 mb-5">
                Race clock
              </p>
              <LiveClock />
            </div>
          </div>
        </div>
      </section>

      {/* Next Event Spotlight */}
      {nextOpen && (
        <section className="bg-terracotta text-white">
          <div className="mx-auto max-w-6xl px-6 py-10 md:py-14">
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-center">
              <div className="lg:col-span-3">
                <p className="font-mono text-xs uppercase tracking-[0.25em] text-white/70 mb-3">
                  Next event
                </p>
                <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">
                  {nextOpen.name}
                </h2>
                <p className="mt-2 text-white/85 text-sm md:text-base">
                  {formatDate(nextOpen.date)} · {nextOpen.venue}
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-white/80">
                  <span className="font-mono">
                    ${(nextOpen.entry_fee_cents / 100).toFixed(0)} entry
                  </span>
                  <span className="text-white/40">·</span>
                  <span className="font-mono">
                    {countMap.get(nextOpen.id) ?? 0} entered
                  </span>
                </div>
                <Link
                  href={`/events/${nextOpen.slug}`}
                  className="inline-block mt-6 bg-white text-terracotta font-medium px-6 py-3 text-sm hover:bg-bone transition-colors"
                >
                  Enter now →
                </Link>
              </div>

              <div className="lg:col-span-2 lg:border-l lg:border-white/20 lg:pl-8">
                <p className="font-mono text-xs uppercase tracking-[0.25em] text-white/60 mb-4">
                  Start gun in
                </p>
                <Countdown target={nextOpen.date} className="text-white" />
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Full-bleed photo band */}
      <section className="bg-midnight">
        <div className="relative w-full h-[320px] md:h-[460px] lg:h-[540px] overflow-hidden">
          <Image
            src="/images/athlete-track-lane.jpg"
            alt="Runner warming up at a Running TT venue"
            fill
            priority
            sizes="100vw"
            className="object-cover object-center"
          />
          <div
            aria-hidden
            className="absolute inset-0 bg-gradient-to-t from-midnight/80 via-midnight/10 to-transparent"
          />
        </div>
      </section>

      {/* Stats */}
      <section className="bg-bone border-y border-stone/40">
        <div className="mx-auto max-w-6xl px-6 py-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {stats.map((stat) => (
              <div key={stat.label}>
                <p className="text-2xl md:text-3xl font-semibold tracking-tight font-mono">
                  {stat.value}
                </p>
                <p className="text-sm text-dust mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Upcoming Events */}
      <section className="bg-bone">
        <div className="mx-auto max-w-6xl px-6 py-16 md:py-24">
          <div className="flex items-end justify-between mb-10">
            <div>
              <p className="text-xs text-dust uppercase tracking-wide mb-2">
                Upcoming
              </p>
              <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">
                Events
              </h2>
            </div>
            <Link
              href="/events"
              className="text-sm text-terracotta hover:text-terracotta/80 transition-colors"
            >
              View all →
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {upcomingEvents.results.map((event) => (
              <EventCard
                key={event.id}
                slug={event.slug}
                name={event.name}
                distance={event.distance}
                date={event.date}
                location={event.location}
                venue={event.venue}
                status={displayStatus(event.status, event.date)}
                entryCount={countMap.get(event.id) ?? 0}
                entryFeeCents={event.entry_fee_cents}
              />
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-stone">
        <div className="mx-auto max-w-6xl px-6 py-16 md:py-24">
          <div className="flex items-end justify-between mb-12">
            <div>
              <p className="text-xs text-dust uppercase tracking-wide mb-2">
                The format
              </p>
              <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">
                How it works
              </h2>
            </div>
            <Link
              href="/format"
              className="text-sm text-terracotta hover:text-terracotta/80 transition-colors"
            >
              Full breakdown →
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {steps.map((step) => (
              <div
                key={step.number}
                className="border-t-2 border-midnight/10 pt-5"
              >
                <p className="text-sm font-mono text-terracotta mb-3">
                  {step.number}
                </p>
                <h3 className="font-semibold tracking-tight mb-2">
                  {step.title}
                </h3>
                <p className="text-sm text-midnight/60 leading-relaxed">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Prize Money */}
      <section className="bg-midnight text-white">
        <div className="mx-auto max-w-6xl px-6 py-16 md:py-24">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-end">
            <div>
              <p className="text-xs text-gold uppercase tracking-[0.2em] mb-3">
                Every event
              </p>
              <h2 className="text-3xl md:text-4xl font-semibold tracking-tight mb-5">
                Prize money. Always.
              </h2>
              <p className="text-stone/70 leading-relaxed">
                Every Running TT event pays out prize money. No qualifying
                standards, no conditions. You show up, you race, the fastest
                three get paid. That simple.
              </p>
              <p className="text-stone/70 leading-relaxed mt-4">
                Entry is a flat{" "}
                <span className="font-mono text-white">$15</span>, every event,
                every distance. The purse is funded by entry fees plus cash
                from our sponsors.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-4">
              {[
                { place: "1st", amount: "$2,000" },
                { place: "2nd", amount: "$1,000" },
                { place: "3rd", amount: "$500" },
              ].map((prize, i) => (
                <div
                  key={prize.place}
                  className={`border border-white/10 p-5 md:p-6 ${
                    i === 0 ? "bg-gold/5" : ""
                  }`}
                >
                  <p className="text-xs text-stone/50 mb-2 font-mono uppercase tracking-wider">
                    {prize.place}
                  </p>
                  <p className="text-2xl md:text-3xl font-mono font-semibold text-gold">
                    {prize.amount}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <Sponsors />
    </>
  );
}
