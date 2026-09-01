import { getDB } from "@/lib/db";
import { getSession } from "@/lib/auth";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import EnterEventButton from "@/components/EnterEventButton";
import Countdown from "@/components/Countdown";
import LiveRefresh from "@/components/LiveRefresh";
import { displayStatus, todayInMelbourne } from "@/lib/events";
import { parsePrizes } from "@/lib/racetime";
import { AGE_GROUPS } from "@/lib/agegroups";

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
  prizes: string | null;
}

interface LeaderboardRow {
  rank: number;
  name: string;
  user_id: string;
  time_display: string;
  heat_number: number;
  verified: number;
  prize_amount_cents: number;
  age_group: string | null;
  age_group_rank: number | null;
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
    .prepare("SELECT name, distance, date, venue, description FROM events WHERE slug = ?")
    .bind(slug)
    .first<{ name: string; distance: string; date: string; venue: string; description: string | null }>();

  if (!event) return { title: "Event · Running TT" };

  return {
    title: `${event.name} · Running TT`,
    description:
      event.description ??
      `${event.distance} time trial at ${event.venue} on ${formatDate(event.date)}. Enter on Running TT.`,
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

  if (!event) notFound();

  const eventPrizes = parsePrizes(event.prizes);

  const entryCount = await db
    .prepare(
      "SELECT COUNT(*) as count FROM entries WHERE event_id = ? AND status = 'confirmed'"
    )
    .bind(event.id)
    .first<{ count: number }>();

  const leaderboard = await db
    .prepare(
      `SELECT r.rank, r.time_display, r.heat_number, r.verified, r.prize_amount_cents,
              r.age_group, r.age_group_rank, u.name, u.id as user_id
       FROM results r
       JOIN users u ON r.user_id = u.id
       WHERE r.event_id = ?
       ORDER BY r.rank ASC`
    )
    .bind(event.id)
    .all() as unknown as { results: LeaderboardRow[] };

  const avgTime = await db
    .prepare("SELECT AVG(time_seconds) as avg FROM results WHERE event_id = ?")
    .bind(event.id)
    .first<{ avg: number | null }>();

  const avgDisplay = avgTime?.avg
    ? `${Math.floor(avgTime.avg / 60)}:${String(Math.floor(avgTime.avg % 60)).padStart(2, "0")}`
    : "-";

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
    Completed: "bg-white/15 text-white",
    "Coming Soon": "bg-stone text-midnight/70",
  };

  const today = todayInMelbourne();
  const eventStatus = displayStatus(event.status, event.date);
  const isUpcoming = eventStatus === "Open" || eventStatus === "Coming Soon";
  const isRaceDay = event.date === today;

  // Age group standings, in band order, only for groups with a finisher.
  const groups = AGE_GROUPS.map((group) => ({
    group,
    rows: leaderboard.results.filter((r) => r.age_group === group),
  })).filter((g) => g.rows.length > 0);
  const ungrouped = leaderboard.results.filter((r) => !r.age_group);

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
          className="object-cover object-[center_40%] opacity-30 scale-105 motion-safe:animate-slow-zoom"
          aria-hidden
        />
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-b from-midnight/60 via-midnight/70 to-midnight"
        />
        <div className="relative mx-auto max-w-6xl px-6 pt-10 pb-14 md:pt-14 md:pb-20">
          <Link
            href="/events"
            className="text-xs text-stone/60 hover:text-white transition-colors mb-8 inline-block font-mono uppercase tracking-[0.2em]"
          >
            &larr; All events
          </Link>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 items-end">
            <div className="lg:col-span-2 motion-safe:animate-fade-up">
              <p className="font-mono text-xs uppercase tracking-[0.25em] text-terracotta mb-4">
                {event.distance} · {event.location}
              </p>
              <div className="flex flex-wrap items-center gap-3 mb-5">
                <h1 className="text-4xl md:text-6xl font-semibold tracking-tight leading-[1.02]">
                  {event.name}
                </h1>
                <span
                  className={`text-[10px] font-medium uppercase tracking-wider px-2.5 py-1 ${statusStyles[eventStatus] || ""}`}
                >
                  {eventStatus}
                </span>
                {isRaceDay && leaderboard.results.length > 0 && <LiveRefresh />}
              </div>
              <div className="flex flex-wrap items-center gap-3 text-base text-stone/80">
                <span>{formatDate(event.date)}</span>
                <span className="text-stone/30">·</span>
                <span className="font-mono">{event.time}</span>
                <span className="text-stone/30">·</span>
                <span>{event.venue}</span>
              </div>
            </div>

            {isUpcoming && !isRaceDay && (
              <div className="lg:border-l lg:border-white/10 lg:pl-8">
                <p className="font-mono text-xs uppercase tracking-[0.25em] text-stone/50 mb-4">
                  Start gun in
                </p>
                <Countdown target={event.date} className="text-white" />
              </div>
            )}
            {isRaceDay && (
              <div className="lg:border-l lg:border-white/10 lg:pl-8">
                <p className="font-mono text-xs uppercase tracking-[0.25em] text-terracotta mb-2">
                  Race day
                </p>
                <p className="text-2xl font-semibold tracking-tight">Today, {event.time}</p>
                <p className="text-sm text-stone/60 mt-1">{event.venue}</p>
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
              <p className="text-sm text-dust mt-1">entered</p>
            </div>
            <div>
              <p className="text-2xl font-mono font-semibold tracking-tight">
                {leaderboard.results[0]?.time_display ?? event.course_record ?? "-"}
              </p>
              <p className="text-sm text-dust mt-1">fastest time</p>
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

      <div className="mx-auto max-w-6xl px-6 py-14 md:py-20">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          <div className="lg:col-span-2 space-y-14">
            {/* Overall leaderboard */}
            <div>
              <div className="flex items-end justify-between mb-6">
                <div>
                  <p className="text-xs text-dust uppercase tracking-[0.2em] mb-2">
                    Overall
                  </p>
                  <h2 className="text-xl font-semibold tracking-tight">
                    Leaderboard
                  </h2>
                </div>
                {leaderboard.results.length > 0 && (
                  <p className="text-sm text-dust font-mono">
                    {leaderboard.results.length} finisher
                    {leaderboard.results.length === 1 ? "" : "s"}
                  </p>
                )}
              </div>

              {leaderboard.results.length > 0 ? (
                <div className="bg-white border border-stone/40 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-midnight text-stone/60 text-left text-[10px] uppercase tracking-[0.2em] font-mono">
                        <th className="px-4 py-3 w-14">Pos</th>
                        <th className="px-4 py-3">Athlete</th>
                        <th className="px-4 py-3 hidden sm:table-cell">Age group</th>
                        <th className="px-4 py-3 text-right">Time</th>
                        <th className="px-4 py-3 hidden md:table-cell w-20">Heat</th>
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
                            key={entry.user_id}
                            className={`border-b border-stone/20 last:border-b-0 hover:bg-bone/60 transition-colors ${podium}`}
                          >
                            <td className={`px-4 py-3 font-mono font-semibold tabular-nums ${rankColor}`}>
                              {String(entry.rank).padStart(2, "0")}
                            </td>
                            <td className="px-4 py-3">
                              <Link
                                href={`/athletes/${entry.user_id}`}
                                className="font-medium hover:text-terracotta transition-colors"
                              >
                                {entry.name}
                              </Link>
                              <span className="sm:hidden block text-[11px] text-dust mt-0.5">
                                {entry.age_group ?? ""}
                              </span>
                            </td>
                            <td className="px-4 py-3 hidden sm:table-cell text-midnight/70">
                              {entry.age_group ?? "-"}
                              {entry.age_group_rank === 1 && (
                                <span className="ml-2 text-[10px] uppercase tracking-wider text-gold">1st</span>
                              )}
                            </td>
                            <td className="px-4 py-3 font-mono tabular-nums text-right font-semibold">
                              {entry.time_display}
                            </td>
                            <td className="px-4 py-3 font-mono text-dust hidden md:table-cell tabular-nums">
                              H{entry.heat_number}
                            </td>
                            <td className="px-4 py-3 text-right hidden sm:table-cell font-mono tabular-nums">
                              {entry.prize_amount_cents > 0 ? (
                                <span className="text-gold">${entry.prize_amount_cents / 100}</span>
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
                    {isRaceDay ? "Race day" : eventStatus === "Completed" ? "Results pending" : "Awaiting start"}
                  </p>
                  <p className="text-sm text-midnight/60">
                    {isRaceDay
                      ? "Times go up here as each heat finishes."
                      : eventStatus === "Completed"
                        ? "Times are being finalised."
                        : "Times go up here the moment they are recorded."}
                  </p>
                </div>
              )}
            </div>

            {/* Age groups */}
            {groups.length > 0 && (
              <div>
                <p className="text-xs text-dust uppercase tracking-[0.2em] mb-2">
                  By age
                </p>
                <h2 className="text-xl font-semibold tracking-tight mb-6">
                  Age group results
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {groups.map(({ group, rows }) => (
                    <div key={group} className="bg-white border border-stone/40">
                      <div className="px-4 py-3 border-b border-stone/30 flex items-center justify-between">
                        <p className="font-semibold tracking-tight">{group}</p>
                        <p className="font-mono text-xs text-dust">{rows.length}</p>
                      </div>
                      <div className="divide-y divide-stone/20">
                        {rows.map((r) => (
                          <div key={r.user_id} className="px-4 py-2.5 flex items-center gap-3 text-sm">
                            <span
                              className={`font-mono tabular-nums w-6 ${
                                r.age_group_rank === 1 ? "text-gold font-semibold" : "text-midnight/40"
                              }`}
                            >
                              {r.age_group_rank}
                            </span>
                            <Link
                              href={`/athletes/${r.user_id}`}
                              className="flex-1 font-medium truncate hover:text-terracotta transition-colors"
                            >
                              {r.name}
                            </Link>
                            <span className="font-mono tabular-nums">{r.time_display}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                {ungrouped.length > 0 && (
                  <p className="mt-4 text-xs text-midnight/50">
                    {ungrouped.length} finisher{ungrouped.length === 1 ? "" : "s"} without a
                    date of birth on file are shown in the overall results only.
                  </p>
                )}
              </div>
            )}

            {/* Prize Money */}
            {eventPrizes.length > 0 && (
              <div>
                <p className="text-xs text-dust uppercase tracking-[0.2em] mb-2">
                  Purse
                </p>
                <h2 className="text-xl font-semibold tracking-tight mb-6">
                  Prize money
                </h2>
                <div
                  className={`grid gap-4 ${
                    eventPrizes.length >= 3
                      ? "grid-cols-1 sm:grid-cols-3"
                      : "grid-cols-1 sm:grid-cols-2"
                  }`}
                >
                  {eventPrizes.map((prize) => (
                    <div key={prize.label} className="bg-white border border-stone/40 p-5 text-center">
                      <p className="text-xs text-dust mb-1">{prize.label}</p>
                      <p className="text-2xl font-mono font-semibold text-gold">{prize.amount}</p>
                    </div>
                  ))}
                </div>
                <p className="mt-4 text-xs text-midnight/50">
                  Handed out on the day, at the finish.
                </p>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-8">
            {isUpcoming && (
              <div className="bg-white border border-stone/40 p-6 lg:sticky lg:top-24">
                <h3 className="font-semibold tracking-tight mb-2">
                  {eventStatus === "Open" ? "Enter this event" : "Coming soon"}
                </h3>
                <p className="text-sm text-midnight/60 mb-4">
                  {eventStatus === "Open"
                    ? `${entryCount?.count ?? 0} ${
                        (entryCount?.count ?? 0) === 1 ? "athlete has" : "athletes have"
                      } locked in. Rolling heats, so get in early.`
                    : "Entries will open soon."}
                </p>
                <EnterEventButton
                  eventId={event.id}
                  eventStatus={eventStatus}
                  entryFeeCents={event.entry_fee_cents}
                  isLoggedIn={!!session}
                  profileCompleted={!!session?.user.profileCompleted}
                  alreadyEntered={alreadyEntered}
                />
                <p className="mt-3 text-xs text-midnight/50 leading-relaxed">
                  {event.entry_fee_cents > 0
                    ? `$${(event.entry_fee_cents / 100).toFixed(0)} AUD entry. Entry fees and sponsor cash fund the prize purse.`
                    : "Free entry for this event."}{" "}
                  By entering you agree to the{" "}
                  <Link href="/terms" className="underline underline-offset-2 hover:text-terracotta transition-colors">
                    terms of entry
                  </Link>
                  .
                </p>
              </div>
            )}

            {event.description && (
              <div className="bg-white border border-stone/40 p-6">
                <h3 className="font-semibold tracking-tight mb-3">About this event</h3>
                <p className="text-sm text-midnight/60 leading-relaxed mb-4">
                  {event.description}
                </p>
                {event.check_in && (
                  <p className="text-sm text-midnight/60 leading-relaxed mb-4">{event.check_in}</p>
                )}
                {whatToBring.length > 0 && (
                  <>
                    <p className="text-sm font-medium mb-2">What to bring</p>
                    <ul className="text-sm text-midnight/60 space-y-1">
                      {whatToBring.map((item) => (
                        <li key={item} className="flex gap-2">
                          <span className="text-terracotta mt-0.5">·</span>
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
