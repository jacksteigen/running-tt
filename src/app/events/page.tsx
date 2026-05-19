import type { Metadata } from "next";
import { getDB } from "@/lib/db";
import EventCard from "@/components/EventCard";
import AustraliaFlightMap from "@/components/AustraliaFlightMap";
import { displayStatus } from "@/lib/events";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Events · Running TT",
  description:
    "Upcoming and past Running TT time trial events in Geelong and Melbourne.",
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
}

export default async function EventsPage() {
  const db = await getDB();

  const allEvents = await db
    .prepare("SELECT * FROM events ORDER BY date ASC")
    .all() as unknown as { results: EventRow[] };

  // Upcoming/past split by date, not status, so events flip automatically once
  // their date has passed. Past events are reversed so the most recent shows first.
  const todayISO = new Date().toISOString().slice(0, 10);
  const upcoming = allEvents.results.filter((e) => e.date >= todayISO);
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
      <section className="bg-midnight text-white">
        <div className="mx-auto max-w-6xl px-6 py-16 md:py-20">
          <p className="font-mono text-xs text-stone/50 uppercase tracking-[0.25em] mb-3">
            Running TT
          </p>
          <h1 className="text-3xl md:text-5xl font-semibold tracking-tight">
            Events
          </h1>
          <p className="mt-4 text-stone/60 max-w-lg">
            Time trials across Geelong and Melbourne. Rolling heats of 8, live
            leaderboard, prize money for the top 3.
          </p>
        </div>
      </section>

      <section className="bg-bone">
        <div className="mx-auto max-w-6xl px-6 py-16 md:py-24">
          {upcoming.length > 0 && (
            <div className="mb-20">
              <div className="flex items-end justify-between mb-8">
                <div>
                  <p className="text-xs text-dust uppercase tracking-[0.2em] mb-2">
                    Upcoming
                  </p>
                  <h2 className="text-2xl font-semibold tracking-tight">
                    Open for entry
                  </h2>
                </div>
                <p className="text-sm text-dust font-mono">
                  {upcoming.length} event{upcoming.length === 1 ? "" : "s"}
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {upcoming.map((event) => (
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
          )}

          {past.length > 0 ? (
            <div>
              <div className="flex items-end justify-between mb-8">
                <div>
                  <p className="text-xs text-dust uppercase tracking-[0.2em] mb-2">
                    Completed
                  </p>
                  <h2 className="text-2xl font-semibold tracking-tight">
                    Past events
                  </h2>
                </div>
                <p className="text-sm text-dust font-mono">
                  {past.length} event{past.length === 1 ? "" : "s"}
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {past.map((event) => (
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
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="border border-stone/40 bg-white p-12 text-center">
              <p className="text-dust text-sm">
                No past events yet. The first one is coming.
              </p>
            </div>
          )}
        </div>
      </section>

      <AustraliaFlightMap />
    </>
  );
}
