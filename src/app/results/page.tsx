import type { Metadata } from "next";
import Link from "next/link";
import { getDB } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Results · Running TT",
  description:
    "Every past Running TT event, with leaderboards, podiums and prize money awarded.",
};

interface EventRow {
  id: string;
  slug: string;
  name: string;
  distance: string;
  date: string;
  location: string;
  venue: string;
}

interface PodiumRow {
  event_id: string;
  rank: number;
  user_id: string;
  user_name: string;
  time_display: string;
  prize_amount_cents: number;
  verified: number;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatDayMonth(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  const day = d.toLocaleDateString("en-AU", { day: "2-digit" });
  const month = d.toLocaleDateString("en-AU", { month: "short" }).toUpperCase();
  return { day, month };
}

export default async function ResultsPage() {
  const db = await getDB();

  // Past events (date has passed), most recent first.
  const past = await db
    .prepare("SELECT * FROM events WHERE date < date('now') ORDER BY date DESC")
    .all() as unknown as { results: EventRow[] };

  // All podium finishers across past events, in one query.
  const podiums = await db
    .prepare(
      `SELECT r.event_id, r.rank, r.time_display, r.prize_amount_cents, r.verified,
              u.id as user_id, u.name as user_name
       FROM results r
       JOIN users u ON r.user_id = u.id
       WHERE r.rank <= 3
       ORDER BY r.event_id, r.rank ASC`
    )
    .all() as unknown as { results: PodiumRow[] };

  const podiumsByEvent = new Map<string, PodiumRow[]>();
  for (const p of podiums.results) {
    const list = podiumsByEvent.get(p.event_id) ?? [];
    list.push(p);
    podiumsByEvent.set(p.event_id, list);
  }

  // All-time records: fastest time per distance across every RTT result.
  interface RecordRow {
    time_display: string;
    time_seconds: number;
    verified: number;
    user_id: string;
    user_name: string;
    distance: string;
    event_name: string;
    event_slug: string;
    date: string;
  }
  const allTimes = await db
    .prepare(
      `SELECT r.time_display, r.time_seconds, r.verified,
              u.id as user_id, u.name as user_name,
              ev.distance, ev.name as event_name, ev.slug as event_slug, ev.date
       FROM results r
       JOIN users u ON r.user_id = u.id
       JOIN events ev ON r.event_id = ev.id
       ORDER BY r.time_seconds ASC`
    )
    .all() as unknown as { results: RecordRow[] };

  const recordOrder = ["Mile", "3K", "5K", "10K"];
  const recordsByDistance = new Map<string, RecordRow>();
  for (const row of allTimes.results) {
    if (!recordsByDistance.has(row.distance)) {
      recordsByDistance.set(row.distance, row);
    }
  }
  const records = recordOrder
    .filter((d) => recordsByDistance.has(d))
    .concat(
      [...recordsByDistance.keys()].filter((d) => !recordOrder.includes(d))
    )
    .map((d) => recordsByDistance.get(d) as RecordRow);

  // Aggregate stats across past events
  const totalRaces = past.results.length;
  const totalFinishersRes = await db
    .prepare(
      "SELECT COUNT(*) as count FROM results r JOIN events ev ON r.event_id = ev.id WHERE ev.date < date('now')"
    )
    .first<{ count: number }>();
  const totalPayoutRes = await db
    .prepare(
      "SELECT COALESCE(SUM(r.prize_amount_cents), 0) as total FROM results r JOIN events ev ON r.event_id = ev.id WHERE ev.date < date('now')"
    )
    .first<{ total: number }>();

  return (
    <>
      {/* Header */}
      <section className="bg-midnight text-white relative overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(90deg, transparent 0 79px, #F5F2EC 79px 80px)",
          }}
        />
        <div className="mx-auto max-w-6xl px-6 py-14 md:py-20 relative">
          <p className="font-mono text-xs uppercase tracking-[0.25em] text-terracotta mb-5">
            Results
          </p>
          <h1 className="text-3xl md:text-5xl font-semibold tracking-tight leading-[1.05] max-w-2xl">
            Every time, every podium, every dollar paid out.
          </h1>
          <p className="mt-4 text-stone/60 max-w-xl">
            Running TT publishes the full leaderboard for every event. Times
            stay up forever. Past winners keep their records on the page.
          </p>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 md:gap-6 mt-10 pt-8 border-t border-stone/10">
            <div>
              <p className="font-mono text-2xl md:text-3xl font-semibold tabular-nums">
                {totalRaces}
              </p>
              <p className="text-xs uppercase tracking-[0.2em] text-stone/50 mt-1">
                Events
              </p>
            </div>
            <div>
              <p className="font-mono text-2xl md:text-3xl font-semibold tabular-nums">
                {totalFinishersRes?.count ?? 0}
              </p>
              <p className="text-xs uppercase tracking-[0.2em] text-stone/50 mt-1">
                Finishers
              </p>
            </div>
            <div>
              <p className="font-mono text-2xl md:text-3xl font-semibold tabular-nums text-gold">
                ${((totalPayoutRes?.total ?? 0) / 100).toLocaleString("en-AU")}
              </p>
              <p className="text-xs uppercase tracking-[0.2em] text-stone/50 mt-1">
                Paid out
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* All-time records */}
      {records.length > 0 && (
        <section className="bg-stone border-b border-stone/40">
          <div className="mx-auto max-w-6xl px-6 py-14 md:py-20">
            <div className="flex items-end justify-between mb-8">
              <div>
                <p className="text-xs text-dust uppercase tracking-[0.2em] mb-2">
                  All-time
                </p>
                <h2 className="text-2xl font-semibold tracking-tight">
                  Running TT records
                </h2>
              </div>
              <p className="hidden sm:block text-sm text-dust max-w-xs text-right">
                Fastest time ever recorded at a Running TT event, per distance.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {records.map((rec) => (
                <div
                  key={rec.distance}
                  className="bg-white border border-stone/40 overflow-hidden"
                >
                  <div className="bg-midnight text-white px-4 py-2 flex items-center justify-between">
                    <p className="font-mono text-[10px] uppercase tracking-[0.2em]">
                      {rec.distance}
                    </p>
                    {rec.verified === 1 && (
                      <span
                        className="inline-flex items-center gap-1 text-[10px] text-trail"
                        title="Verified"
                      >
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-trail" />
                        verified
                      </span>
                    )}
                  </div>
                  <div className="px-4 py-5">
                    <p className="text-3xl font-mono font-semibold tracking-tight tabular-nums text-gold">
                      {rec.time_display}
                    </p>
                    <Link
                      href={`/athletes/${rec.user_id}`}
                      className="block mt-2 font-medium hover:text-terracotta transition-colors"
                    >
                      {rec.user_name}
                    </Link>
                    <Link
                      href={`/events/${rec.event_slug}`}
                      className="block text-xs text-midnight/50 hover:text-terracotta transition-colors mt-1"
                    >
                      {rec.event_name}
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="bg-bone">
        <div className="mx-auto max-w-6xl px-6 py-16 md:py-20">
          {past.results.length === 0 ? (
            <div className="bg-white border border-stone/40 p-12 text-center max-w-xl mx-auto">
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-dust mb-2">
                Awaiting the first start gun
              </p>
              <p className="text-midnight/60">
                Results from completed events will appear here.
              </p>
              <Link
                href="/events"
                className="inline-block mt-6 bg-midnight text-white text-sm font-medium px-5 py-2.5 hover:bg-midnight/90 transition-colors"
              >
                See upcoming events
              </Link>
            </div>
          ) : (
            <div className="space-y-5">
              {past.results.map((event) => {
                const { day, month } = formatDayMonth(event.date);
                const podium = podiumsByEvent.get(event.id) ?? [];
                return (
                  <Link
                    key={event.id}
                    href={`/events/${event.slug}`}
                    className="group block bg-white border border-stone/40 hover:border-midnight/30 transition-colors"
                  >
                    {/* Top band */}
                    <div className="flex items-center justify-between bg-midnight text-white px-5 py-3">
                      <p className="font-mono text-xs tracking-[0.2em] uppercase">
                        {event.distance} · {event.location}
                      </p>
                      <span className="font-mono text-[10px] uppercase tracking-wider text-stone/50">
                        {formatDate(event.date)}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-0">
                      {/* Name + date block */}
                      <div className="p-5 md:p-6 md:border-r border-b md:border-b-0 border-stone/30 flex items-start gap-5">
                        <div className="shrink-0 text-center border-r border-stone/40 pr-4">
                          <p className="font-mono text-3xl font-semibold tracking-tight leading-none">
                            {day}
                          </p>
                          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-dust mt-1">
                            {month}
                          </p>
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-semibold tracking-tight group-hover:text-terracotta transition-colors">
                            {event.name}
                          </h3>
                          <p className="text-sm text-midnight/60 mt-1">
                            {event.venue}
                          </p>
                          <p className="text-xs text-terracotta mt-3 font-medium">
                            View full leaderboard →
                          </p>
                        </div>
                      </div>

                      {/* Podium */}
                      <div className="md:col-span-2 p-5 md:p-6">
                        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-dust mb-3">
                          Podium
                        </p>
                        {podium.length > 0 ? (
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            {podium.map((p) => {
                              const rankColor =
                                p.rank === 1
                                  ? "border-gold text-gold"
                                  : p.rank === 2
                                    ? "border-stone text-midnight"
                                    : "border-dust text-midnight";
                              return (
                                <div
                                  key={p.rank}
                                  className={`border-l-2 pl-3 ${rankColor.split(" ")[0]}`}
                                >
                                  <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-dust">
                                    {p.rank === 1
                                      ? "1st"
                                      : p.rank === 2
                                        ? "2nd"
                                        : "3rd"}
                                  </p>
                                  <p
                                    className={`font-medium ${rankColor.split(" ")[1] ?? ""}`}
                                  >
                                    {p.user_name}
                                  </p>
                                  <p className="font-mono text-sm tabular-nums mt-0.5">
                                    {p.time_display}
                                  </p>
                                  {p.prize_amount_cents > 0 && (
                                    <p className="font-mono text-xs text-gold mt-0.5 tabular-nums">
                                      ${p.prize_amount_cents / 100}
                                    </p>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-sm text-midnight/50">
                            Full results on the event page.
                          </p>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
