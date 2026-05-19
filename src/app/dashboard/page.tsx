import { getDB } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
import Link from "next/link";
import type { Metadata } from "next";
import LogoutButton from "@/components/LogoutButton";
import ProfileForm from "@/components/ProfileForm";
import PBCard from "@/components/PBCard";
import ResultsTable from "@/components/ResultsTable";
import Countdown from "@/components/Countdown";

export const metadata: Metadata = {
  title: "Dashboard · Running TT",
};

function formatDayMonth(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  const day = d.toLocaleDateString("en-AU", { day: "2-digit" });
  const month = d.toLocaleDateString("en-AU", { month: "short" }).toUpperCase();
  const weekday = d
    .toLocaleDateString("en-AU", { weekday: "short" })
    .toUpperCase();
  return { day, month, weekday };
}

function formatLongDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default async function DashboardPage() {
  const db = await getDB();
  const session = await getSession(db);

  if (!session) {
    redirect("/login");
  }

  const { user } = session;

  interface EntryRow {
    entry_id: string;
    status: string;
    entered_at: string;
    event_id: string;
    slug: string;
    name: string;
    distance: string;
    date: string;
    time: string;
    venue: string;
    event_status: string;
  }

  interface ResultRow {
    id: string;
    time_display: string;
    heat_number: number;
    rank: number;
    verified: number;
    prize_amount_cents: number;
    event_name: string;
    event_slug: string;
    distance: string;
  }

  interface PBRow {
    distance: string;
    time_display: string;
    verified: number;
  }

  // Fetch user's entries with event details
  const entries = await db
    .prepare(
      `SELECT e.id as entry_id, e.status, e.created_at as entered_at,
              ev.id as event_id, ev.slug, ev.name, ev.distance, ev.date, ev.time, ev.venue, ev.status as event_status
       FROM entries e
       JOIN events ev ON e.event_id = ev.id
       WHERE e.user_id = ?
       ORDER BY ev.date DESC`
    )
    .bind(user.id)
    .all() as unknown as { results: EntryRow[] };

  // Fetch user's results
  const results = await db
    .prepare(
      `SELECT r.*, ev.name as event_name, ev.slug as event_slug, ev.distance
       FROM results r
       JOIN events ev ON r.event_id = ev.id
       WHERE r.user_id = ?
       ORDER BY ev.date DESC`
    )
    .bind(user.id)
    .all() as unknown as { results: ResultRow[] };

  // Fetch personal bests
  const pbs = await db
    .prepare(
      "SELECT * FROM personal_bests WHERE user_id = ? ORDER BY distance"
    )
    .bind(user.id)
    .all() as unknown as { results: PBRow[] };

  const initials = user.name
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  // Upcoming entries, sorted ascending by date so the soonest is first.
  const upcomingEntries = entries.results
    .filter(
      (e) => e.event_status === "Open" || e.event_status === "Coming Soon"
    )
    .sort((a, b) => a.date.localeCompare(b.date));
  const soonestUpcoming = upcomingEntries[0];

  // Summary stats
  const totalRaces = results.results.length;
  const podiums = results.results.filter((r) => r.rank <= 3).length;
  const earnings = results.results.reduce(
    (sum, r) => sum + (r.prize_amount_cents || 0),
    0
  );

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
        <div className="mx-auto max-w-6xl px-6 py-12 md:py-16 relative">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-start gap-4 md:gap-5">
              <div className="w-16 h-16 md:w-20 md:h-20 bg-terracotta/15 border border-terracotta/30 text-terracotta flex items-center justify-center font-mono text-xl md:text-2xl font-semibold tracking-tight shrink-0">
                {initials}
              </div>
              <div className="pt-1">
                <p className="font-mono text-xs uppercase tracking-[0.25em] text-terracotta mb-1">
                  Your dashboard
                </p>
                <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
                  {user.name}
                </h1>
                <p className="text-sm text-stone/60 mt-1">{user.email}</p>
              </div>
            </div>
            <LogoutButton />
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 md:grid-cols-4 gap-4 md:gap-6 mt-10 pt-8 border-t border-stone/10">
            <div>
              <p className="font-mono text-2xl md:text-3xl font-semibold tabular-nums">
                {upcomingEntries.length}
              </p>
              <p className="text-xs uppercase tracking-[0.2em] text-stone/50 mt-1">
                Upcoming
              </p>
            </div>
            <div>
              <p className="font-mono text-2xl md:text-3xl font-semibold tabular-nums">
                {totalRaces}
              </p>
              <p className="text-xs uppercase tracking-[0.2em] text-stone/50 mt-1">
                Races
              </p>
            </div>
            <div>
              <p className="font-mono text-2xl md:text-3xl font-semibold tabular-nums">
                {podiums}
              </p>
              <p className="text-xs uppercase tracking-[0.2em] text-stone/50 mt-1">
                Podiums
              </p>
            </div>
            <div className="hidden md:block">
              <p className="font-mono text-2xl md:text-3xl font-semibold tabular-nums text-gold">
                ${(earnings / 100).toFixed(0)}
              </p>
              <p className="text-xs uppercase tracking-[0.2em] text-stone/50 mt-1">
                Earned
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Next race spotlight */}
      {soonestUpcoming && (
        <section className="bg-terracotta text-white">
          <div className="mx-auto max-w-6xl px-6 py-8 md:py-10">
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-center">
              <div className="lg:col-span-3">
                <p className="font-mono text-xs uppercase tracking-[0.25em] text-white/70 mb-2">
                  Your next race
                </p>
                <h2 className="text-xl md:text-2xl font-semibold tracking-tight">
                  {soonestUpcoming.name}
                </h2>
                <p className="text-sm text-white/85 mt-1">
                  {formatLongDate(soonestUpcoming.date)} ·{" "}
                  {soonestUpcoming.venue}
                </p>
              </div>
              <div className="lg:col-span-2 lg:border-l lg:border-white/20 lg:pl-6">
                <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-white/60 mb-2">
                  Start gun in
                </p>
                <Countdown
                  target={soonestUpcoming.date}
                  className="text-white"
                />
              </div>
            </div>
          </div>
        </section>
      )}

      <div className="mx-auto max-w-6xl px-6 py-12 md:py-16">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-14">
            {/* Your entries */}
            <div>
              <div className="flex items-end justify-between mb-6">
                <div>
                  <p className="text-xs text-dust uppercase tracking-[0.2em] mb-2">
                    Your entries
                  </p>
                  <h2 className="text-xl font-semibold tracking-tight">
                    Events
                  </h2>
                </div>
                {entries.results.length > 0 && (
                  <p className="text-sm text-dust font-mono">
                    {entries.results.length}
                  </p>
                )}
              </div>
              {entries.results.length > 0 ? (
                <div className="space-y-3">
                  {entries.results.map((entry) => {
                    const { day, month, weekday } = formatDayMonth(entry.date);
                    const statusCls =
                      entry.status === "confirmed"
                        ? "bg-trail text-white"
                        : "bg-gold text-midnight";
                    return (
                      <Link
                        key={entry.entry_id}
                        href={`/events/${entry.slug}`}
                        className="group block bg-white border border-stone/40 hover:border-midnight/30 transition-colors"
                      >
                        <div className="flex items-stretch">
                          {/* Date block */}
                          <div className="shrink-0 bg-bone border-r border-stone/40 px-5 py-4 text-center flex flex-col justify-center">
                            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-dust">
                              {weekday}
                            </p>
                            <p className="font-mono text-2xl font-semibold tracking-tight leading-none mt-1">
                              {day}
                            </p>
                            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-dust mt-1">
                              {month}
                            </p>
                          </div>
                          <div className="flex-1 px-5 py-4 flex items-center justify-between gap-4">
                            <div className="min-w-0">
                              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-dust mb-1">
                                {entry.distance}
                              </p>
                              <h3 className="font-semibold tracking-tight truncate group-hover:text-terracotta transition-colors">
                                {entry.name}
                              </h3>
                              <p className="text-sm text-midnight/60 mt-0.5 truncate">
                                {entry.venue}
                              </p>
                            </div>
                            <span
                              className={`shrink-0 text-[10px] font-medium uppercase tracking-wider px-2 py-1 ${statusCls}`}
                            >
                              {entry.status === "confirmed"
                                ? "Entered"
                                : "Pending"}
                            </span>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <div className="bg-white border border-stone/40 p-10 text-center">
                  <p className="font-mono text-xs uppercase tracking-[0.2em] text-dust mb-3">
                    Start line empty
                  </p>
                  <p className="text-sm text-midnight/60 mb-4">
                    You haven&apos;t entered any events yet.
                  </p>
                  <Link
                    href="/events"
                    className="inline-block bg-midnight text-white text-sm font-medium px-5 py-2.5 hover:bg-midnight/90 transition-colors"
                  >
                    Browse events
                  </Link>
                </div>
              )}
            </div>

            {/* Race history */}
            <div>
              <div className="flex items-end justify-between mb-6">
                <div>
                  <p className="text-xs text-dust uppercase tracking-[0.2em] mb-2">
                    History
                  </p>
                  <h2 className="text-xl font-semibold tracking-tight">
                    Race results
                  </h2>
                </div>
                {totalRaces > 0 && (
                  <p className="text-sm text-dust font-mono">{totalRaces}</p>
                )}
              </div>
              <ResultsTable rows={results.results} />
            </div>

            {/* Personal bests */}
            {pbs.results.length > 0 && (
              <div>
                <div className="flex items-end justify-between mb-6">
                  <div>
                    <p className="text-xs text-dust uppercase tracking-[0.2em] mb-2">
                      Personal bests
                    </p>
                    <h2 className="text-xl font-semibold tracking-tight">
                      Best times
                    </h2>
                  </div>
                  <p className="text-sm text-dust font-mono">
                    {pbs.results.length}
                  </p>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {pbs.results.map((pb) => (
                    <PBCard
                      key={pb.distance}
                      distance={pb.distance}
                      time={pb.time_display}
                      verified={pb.verified === 1}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-8">
            <ProfileForm user={user} />

            {/* Connected accounts */}
            <div className="bg-white border border-stone/40 p-6">
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-dust mb-3">
                Integrations
              </p>
              <h3 className="font-semibold tracking-tight mb-4">
                Connected accounts
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between py-2 border-t border-stone/30">
                  <div>
                    <p className="text-sm font-medium">Strava</p>
                    <p className="text-xs text-midnight/50 mt-0.5">
                      Auto-import activities
                    </p>
                  </div>
                  {user.stravaAthleteId ? (
                    <span className="text-xs text-trail bg-trail/10 px-2 py-1">
                      Connected
                    </span>
                  ) : (
                    <button className="text-xs font-medium text-terracotta border border-terracotta/30 px-3 py-1.5 hover:bg-terracotta/5 transition-colors">
                      Connect
                    </button>
                  )}
                </div>
                <div className="flex items-center justify-between py-2 border-t border-stone/30">
                  <div>
                    <p className="text-sm font-medium">Garmin</p>
                    <p className="text-xs text-midnight/50 mt-0.5">
                      Verify times via GPS
                    </p>
                  </div>
                  {user.garminUserId ? (
                    <span className="text-xs text-trail bg-trail/10 px-2 py-1">
                      Connected
                    </span>
                  ) : (
                    <button className="text-xs font-medium text-terracotta border border-terracotta/30 px-3 py-1.5 hover:bg-terracotta/5 transition-colors">
                      Connect
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
