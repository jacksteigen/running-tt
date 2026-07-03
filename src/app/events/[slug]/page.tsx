import { getDB } from "@/lib/db";
import { getSession } from "@/lib/auth";
import type { Metadata } from "next";
import Link from "next/link";
import EnterEventButton from "@/components/EnterEventButton";
import Countdown from "@/components/Countdown";
import { displayStatus } from "@/lib/events";

export const dynamic = "force-dynamic";

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
  max_entries: number | null;
  description: string | null;
  check_in: string | null;
  what_to_bring: string | null;
  course_record: string | null;
  course_record_holder: string | null;
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

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const db = await getDB();
  const event = await db
    .prepare("SELECT name, description FROM events WHERE slug = ?")
    .bind(slug)
    .first<{ name: string; description: string | null }>();

  return {
    title: event ? `${event.name} · Running TT` : "Event · Running TT",
    description: event?.description ?? undefined,
  };
}

export default async function EventPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const db = await getDB();

  const event = await db
    .prepare("SELECT * FROM events WHERE slug = ?")
    .bind(slug)
    .first<EventRow>();

  if (!event) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-24 text-center">
        <h1 className="text-2xl font-semibold">Event not found</h1>
        <Link
          href="/events"
          className="text-terracotta text-sm mt-4 inline-block"
        >
          Back to events
        </Link>
      </div>
    );
  }

  // Get entry count
  const entryCount = await db
    .prepare(
      "SELECT COUNT(*) as count FROM entries WHERE event_id = ? AND status = 'confirmed'"
    )
    .bind(event.id)
    .first<{ count: number }>();

  interface LeaderboardRow {
    rank: number;
    name: string;
    user_id: string;
    time_display: string;
    heat_number: number;
    verified: number;
    prize_amount_cents: number;
  }

  // Get leaderboard
  const leaderboard = await db
    .prepare(
      `SELECT r.rank, r.time_display, r.heat_number, r.verified, r.prize_amount_cents,
              u.name, u.id as user_id
       FROM results r
       JOIN users u ON r.user_id = u.id
       WHERE r.event_id = ?
       ORDER BY r.rank ASC`
    )
    .bind(event.id)
    .all() as unknown as { results: LeaderboardRow[] };

  // Get average time
  const avgTime = await db
    .prepare(
      "SELECT AVG(time_seconds) as avg FROM results WHERE event_id = ?"
    )
    .bind(event.id)
    .first<{ avg: number | null }>();

  const avgDisplay = avgTime?.avg
    ? `${Math.floor(avgTime.avg / 60)}:${String(
        Math.floor(avgTime.avg % 60)
      ).padStart(2, "0")}`
    : "-";

  // Check if user is logged in and already entered
  const session = await getSession(db);
  let alreadyEntered = false;
  if (session) {
    const entry = await db
      .prepare(
        "SELECT id FROM entries WHERE event_id = ? AND user_id = ? AND status = 'confirmed'"
      )
      .bind(event.id, session.user.id)
      .first();
    alreadyEntered = !!entry;
  }

  const whatToBring: string[] = event.what_to_bring
    ? JSON.parse(event.what_to_bring)
    : [];

  const statusStyles: Record<string, string> = {
    Open: "bg-trail text-white",
    "Sold Out": "bg-terracotta text-white",
    Completed: "bg-dust/40 text-midnight/80",
    "Coming Soon": "bg-stone text-midnight/70",
  };

  // Derived status: forces "Completed" once the date has passed.
  const eventStatus = displayStatus(event.status, event.date);
  const isUpcoming =
    eventStatus === "Open" || eventStatus === "Coming Soon";

  return (
    <>
      {/* Event Header */}
      <section className="bg-midnight text-white">
        <div className="mx-auto max-w-6xl px-6 py-12 md:py-16">
          <Link
            href="/events"
            className="text-xs text-stone/40 hover:text-stone/60 transition-colors mb-6 inline-block font-mono uppercase tracking-[0.2em]"
          >
            ← All events
          </Link>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 items-start">
            <div className="lg:col-span-2">
              <p className="font-mono text-xs uppercase tracking-[0.25em] text-terracotta mb-4">
                {event.distance} · {event.location}
              </p>
              <div className="flex flex-wrap items-start gap-3 mb-4">
                <h1 className="text-3xl md:text-5xl font-semibold tracking-tight leading-[1.05]">
                  {event.name}
                </h1>
                <span
                  className={`text-[10px] font-medium uppercase tracking-wider px-2 py-1 mt-2 ${statusStyles[eventStatus] || ""}`}
                >
                  {eventStatus}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-sm text-stone/60 mt-4">
                <span>{formatDate(event.date)}</span>
                <span className="text-stone/30">·</span>
                <span className="font-mono">{event.time}</span>
                <span className="text-stone/30">·</span>
                <span>{event.venue}</span>
              </div>
            </div>

            {isUpcoming && (
              <div className="lg:border-l lg:border-stone/10 lg:pl-8">
                <p className="font-mono text-xs uppercase tracking-[0.25em] text-stone/40 mb-4">
                  Start gun in
                </p>
                <Countdown target={event.date} className="text-white" />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Stats Row */}
      <section className="bg-bone border-b border-stone/40">
        <div className="mx-auto max-w-6xl px-6 py-8">
          <div className="grid grid-cols-3 gap-6">
            <div>
              <p className="text-2xl font-mono font-semibold tracking-tight">
                {entryCount?.count ?? 0}
              </p>
              <p className="text-sm text-dust mt-1">entries</p>
            </div>
            <div>
              <p className="text-2xl font-mono font-semibold tracking-tight">
                {event.course_record ?? "-"}
              </p>
              <p className="text-sm text-dust mt-1">course record</p>
            </div>
            <div>
              <p className="text-2xl font-mono font-semibold tracking-tight">
                {avgDisplay}
              </p>
              <p className="text-sm text-dust mt-1">average time</p>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-6 py-16 md:py-24">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* Leaderboard */}
          <div className="lg:col-span-2">
            <p className="text-xs text-dust uppercase tracking-wide mb-2">
              Results
            </p>
            <h2 className="text-xl font-semibold tracking-tight mb-6">
              Leaderboard
            </h2>

            {leaderboard.results.length > 0 ? (
              <div className="bg-white border border-stone/40 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-midnight text-stone/60 text-left text-[10px] uppercase tracking-[0.2em] font-mono">
                      <th className="px-4 py-3 w-14">Pos</th>
                      <th className="px-4 py-3">Athlete</th>
                      <th className="px-4 py-3 text-right">Time</th>
                      <th className="px-4 py-3 hidden sm:table-cell w-20">Heat</th>
                      <th className="px-4 py-3 hidden sm:table-cell w-24 text-right">Prize</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboard.results.map((entry) => {
                      const podium =
                        entry.rank === 1
                          ? "border-l-2 border-gold"
                          : entry.rank === 2
                            ? "border-l-2 border-stone"
                            : entry.rank === 3
                              ? "border-l-2 border-dust"
                              : "border-l-2 border-transparent";
                      const rankColor =
                        entry.rank === 1
                          ? "text-gold"
                          : entry.rank <= 3
                            ? "text-midnight"
                            : "text-midnight/40";
                      return (
                        <tr
                          key={entry.rank}
                          className={`border-b border-stone/20 last:border-b-0 hover:bg-bone/60 transition-colors ${podium}`}
                        >
                          <td
                            className={`px-4 py-3 font-mono font-semibold tabular-nums ${rankColor}`}
                          >
                            {String(entry.rank).padStart(2, "0")}
                          </td>
                          <td className="px-4 py-3">
                            <Link
                              href={`/athletes/${entry.user_id}`}
                              className="font-medium hover:text-terracotta transition-colors"
                            >
                              {entry.name}
                            </Link>
                            {entry.verified === 1 && (
                              <span
                                className="ml-2 text-[10px] text-trail inline-flex items-center gap-1"
                                title="Verified time"
                              >
                                <span className="inline-block w-1.5 h-1.5 rounded-full bg-trail" />
                                verified
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 font-mono tabular-nums text-right font-semibold">
                            {entry.time_display}
                          </td>
                          <td className="px-4 py-3 font-mono text-dust hidden sm:table-cell tabular-nums">
                            H{entry.heat_number}
                          </td>
                          <td className="px-4 py-3 text-right hidden sm:table-cell font-mono tabular-nums">
                            {entry.prize_amount_cents > 0 ? (
                              <span className="text-gold">
                                ${entry.prize_amount_cents / 100}
                              </span>
                            ) : (
                              <span className="text-stone/60">-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="bg-white border border-stone/40 p-12 text-center">
                <p className="font-mono text-xs uppercase tracking-[0.2em] text-dust mb-2">
                  Awaiting start
                </p>
                <p className="text-sm text-midnight/60">
                  Times go up here the moment they&apos;re recorded.
                </p>
              </div>
            )}

            {/* Prize Money */}
            <div className="mt-10">
              <p className="text-xs text-dust uppercase tracking-wide mb-2">
                Purse
              </p>
              <h2 className="text-xl font-semibold tracking-tight mb-6">
                Prize money
              </h2>
              <div className="grid grid-cols-3 gap-4">
                {[
                  { place: "1st", amount: "$2,000" },
                  { place: "2nd", amount: "$1,000" },
                  { place: "3rd", amount: "$500" },
                ].map((prize) => (
                  <div
                    key={prize.place}
                    className="bg-white border border-stone/40 p-5 text-center"
                  >
                    <p className="text-xs text-dust mb-1">{prize.place}</p>
                    <p className="text-2xl font-mono font-semibold text-gold">
                      {prize.amount}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-8">
            {/* Entry CTA */}
            {(eventStatus === "Open" || eventStatus === "Coming Soon") && (
              <div className="bg-white border border-stone/40 p-6">
                <h3 className="font-semibold tracking-tight mb-2">
                  {eventStatus === "Open" ? "Enter this event" : "Coming soon"}
                </h3>
                <p className="text-sm text-midnight/60 mb-4">
                  {eventStatus === "Open"
                    ? `${entryCount?.count ?? 0} runners have locked in. Rolling heats, first in best dressed.`
                    : "Entries will open soon."}
                </p>
                <EnterEventButton
                  eventId={event.id}
                  eventStatus={eventStatus}
                  entryFeeCents={event.entry_fee_cents}
                  isLoggedIn={!!session}
                  alreadyEntered={alreadyEntered}
                />
                <p className="mt-3 text-xs text-midnight/50 leading-relaxed">
                  Flat $15 entry at every event. Entry fees and sponsor cash
                  fund the prize purse. By entering you agree to the{" "}
                  <Link
                    href="/terms"
                    className="underline underline-offset-2 hover:text-terracotta transition-colors"
                  >
                    terms of entry
                  </Link>
                  .
                </p>
              </div>
            )}

            {/* Course Info */}
            {event.description && (
              <div className="bg-white border border-stone/40 p-6">
                <h3 className="font-semibold tracking-tight mb-3">
                  Course info
                </h3>
                <p className="text-sm text-midnight/60 leading-relaxed mb-4">
                  {event.description}
                </p>
                {event.check_in && (
                  <p className="text-sm text-midnight/60 leading-relaxed mb-4">
                    {event.check_in}
                  </p>
                )}
                {whatToBring.length > 0 && (
                  <>
                    <p className="text-sm font-medium mb-2">What to bring</p>
                    <ul className="text-sm text-midnight/60 space-y-1">
                      {whatToBring.map((item) => (
                        <li key={item} className="flex gap-2">
                          <span className="text-terracotta mt-0.5">
                            ·
                          </span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
