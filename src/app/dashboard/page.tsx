import { getDB } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
import Link from "next/link";
import type { Metadata } from "next";
import LogoutButton from "@/components/LogoutButton";
import ProfileForm from "@/components/ProfileForm";
import PasswordCard from "@/components/PasswordCard";
import PhotoAlbum from "@/components/PhotoAlbum";
import PBCard from "@/components/PBCard";
import ResultsTable from "@/components/ResultsTable";
import Countdown from "@/components/Countdown";
import { dateParts, formatEventDate, isDateTbc } from "@/lib/dates";
import { buildHeats, hasHeats, heatLabel, type HeatConfig } from "@/lib/heats";
import { bookingRef } from "@/lib/bookings";
import { formatFee } from "@/lib/money";
import { todayInMelbourne } from "@/lib/events";

export const metadata: Metadata = {
  title: "Dashboard · Running TT",
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string; entered?: string }>;
}) {
  const sp = await searchParams;
  const db = await getDB();
  const session = await getSession(db);

  if (!session) {
    redirect("/login");
  }

  const { user } = session;

  // Everyone fills in their athlete profile once before the dashboard opens.
  if (!user.profileCompleted) {
    redirect("/welcome");
  }

  interface EntryRow extends HeatConfig {
    entry_id: string;
    status: string;
    heat_number: number | null;
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
      `SELECT e.id as entry_id, e.status, e.heat_number, e.created_at as entered_at,
              ev.id as event_id, ev.slug, ev.name, ev.distance, ev.date, ev.time, ev.venue, ev.status as event_status,
              ev.first_heat_time, ev.heat_interval_minutes, ev.heat_count, ev.heat_capacity
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

  // Album photos
  const photoRows = await db
    .prepare(
      "SELECT id, r2_key, caption FROM user_photos WHERE user_id = ? ORDER BY sort_order, created_at"
    )
    .bind(user.id)
    .all() as unknown as {
    results: { id: string; r2_key: string; caption: string | null }[];
  };

  const albumPhotos = photoRows.results.map((p) => ({
    id: p.id,
    url: `/api/photos/${p.r2_key}`,
    caption: p.caption ?? "",
  }));

  const initials = user.name
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  // Upcoming means today or later (a TBC date sorts last), soonest first.
  // A confirmed booking takes the spotlight over an unfinished one.
  const today = todayInMelbourne();
  const upcomingEntries = entries.results
    .filter((e) => e.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date));
  const soonestUpcoming =
    upcomingEntries.find((e) => e.status === "confirmed") ?? upcomingEntries[0];
  const spotlightHeat =
    soonestUpcoming && soonestUpcoming.heat_number
      ? buildHeats(soonestUpcoming).find((h) => h.number === soonestUpcoming.heat_number)
      : undefined;

  // A confirmed heat counts down to that heat. An unfinished booking counts
  // down to the first heat, and an event without heats to the start gun.
  const spotlightPending = !!soonestUpcoming && soonestUpcoming.status !== "confirmed";
  const spotlightFirstHeat =
    soonestUpcoming && hasHeats(soonestUpcoming) ? soonestUpcoming.first_heat_time : null;
  const spotlightCountdown = spotlightPending
    ? {
        time: spotlightFirstHeat,
        label: spotlightFirstHeat ? "First heat in" : "Start gun in",
      }
    : {
        time: spotlightHeat?.startTime ?? null,
        label: spotlightHeat?.startTime ? "Your heat starts in" : "Start gun in",
      };

  const spotlight = soonestUpcoming
    ? {
        tbc: isDateTbc(soonestUpcoming.date),
        pending: spotlightPending,
        countdown: spotlightCountdown,
        ...entryLink(soonestUpcoming),
      }
    : null;

  /** Where an entry card leads, and the action it offers. */
  function entryLink(entry: EntryRow): { href: string; action: string | null } {
    const upcoming = entry.date >= today;
    if (upcoming && entry.status === "pending") {
      return {
        href: hasHeats(entry) ? `/events/${entry.slug}/book` : `/events/${entry.slug}`,
        action: "Finish booking",
      };
    }
    if (upcoming && hasHeats(entry)) {
      return { href: `/events/${entry.slug}/booked`, action: "View booking" };
    }
    return { href: `/events/${entry.slug}`, action: null };
  }

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
            <div className="flex items-center gap-2 flex-wrap">
              <Link
                href={`/athletes/${user.id}`}
                className="inline-flex items-center min-h-11 text-xs font-medium text-white border border-white/20 px-4 py-2 hover:border-white/50 transition-colors"
              >
                Public profile
              </Link>
              <Link
                href="#profile"
                className="inline-flex items-center min-h-11 text-xs font-medium text-white border border-white/20 px-4 py-2 hover:border-white/50 transition-colors"
              >
                Edit profile
              </Link>
              {user.isAdmin && (
                <Link
                  href="/admin"
                  className="inline-flex items-center min-h-11 text-xs font-medium bg-terracotta text-white px-4 py-2 hover:bg-terracotta/90 transition-colors"
                >
                  Admin
                </Link>
              )}
              <LogoutButton />
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 md:grid-cols-4 gap-4 md:gap-6 mt-10 pt-8 border-t border-stone/10">
            <div>
              <p className="font-mono text-2xl md:text-3xl font-semibold tabular-nums">
                {upcomingEntries.filter((e) => e.status === "confirmed").length}
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
                {formatFee(earnings)}
              </p>
              <p className="text-xs uppercase tracking-[0.2em] text-stone/50 mt-1">
                Earned
              </p>
            </div>
          </div>
        </div>
      </section>

      {(sp.welcome || sp.entered) && (
        <section className="bg-trail text-white">
          <div className="mx-auto max-w-6xl px-6 py-4 flex items-center gap-3">
            <span className="inline-block w-2 h-2 rounded-full bg-white/80" />
            <p className="text-sm">
              {sp.entered
                ? "You are in. Your entry is confirmed and your spot on the start list is locked."
                : `Welcome to Running TT, ${user.firstName ?? user.name}. Your profile is live.`}
            </p>
          </div>
        </section>
      )}

      {/* Next race spotlight */}
      {soonestUpcoming && spotlight && (
        <section className="bg-terracotta text-white">
          <div className="mx-auto max-w-6xl px-6 py-8 md:py-10">
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-center">
              <div className="lg:col-span-3">
                <p className="font-mono text-xs uppercase tracking-[0.25em] text-white/70 mb-2">
                  {spotlight.pending ? "Finish your booking" : "Your next race"}
                </p>
                <h2 className="text-xl md:text-2xl font-semibold tracking-tight">
                  {soonestUpcoming.name}
                </h2>
                <p className="text-sm text-white/85 mt-1">
                  {spotlight.tbc
                    ? "Date to be announced"
                    : formatEventDate(soonestUpcoming.date, "long")}{" "}
                  · {soonestUpcoming.venue}
                </p>
                {!spotlight.pending && (
                  <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 font-mono text-xs uppercase tracking-[0.2em]">
                    {soonestUpcoming.heat_number && (
                      <span className="bg-white/15 px-2 py-1">
                        {heatLabel(soonestUpcoming, soonestUpcoming.heat_number)}
                      </span>
                    )}
                    <span className="text-white/70">
                      Ref {bookingRef(soonestUpcoming.entry_id)}
                    </span>
                  </p>
                )}
                {spotlight.action && (
                  <Link
                    href={spotlight.href}
                    className="inline-flex items-center gap-2 mt-5 bg-white text-terracotta text-sm font-medium px-5 py-3 min-h-[44px] hover:bg-bone transition-colors"
                  >
                    {spotlight.action} <span aria-hidden>→</span>
                  </Link>
                )}
              </div>
              <div className="lg:col-span-2 lg:border-l lg:border-white/20 lg:pl-6">
                {spotlight.tbc ? (
                  <div className="border-t border-white/20 pt-5 lg:border-t-0 lg:pt-0">
                    <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-white/60 mb-2">
                      What happens next
                    </p>
                    <p className="text-sm md:text-base text-white/90 leading-relaxed max-w-sm">
                      {spotlight.pending
                        ? "Bookings open once the date is locked in. The date and heat times land here first."
                        : "Your spot is held. The date and your heat time land here as soon as they are locked in."}
                    </p>
                  </div>
                ) : (
                  <>
                    <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-white/60 mb-2">
                      {spotlight.countdown.label}
                    </p>
                    <Countdown
                      target={soonestUpcoming.date}
                      time={spotlight.countdown.time}
                      className="text-white"
                    />
                  </>
                )}
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
                    const { day, month, weekday, tbc } = dateParts(entry.date);
                    const { href, action } = entryLink(entry);
                    const confirmed = entry.status === "confirmed";
                    const heat = confirmed ? heatLabel(entry, entry.heat_number) : "";
                    const statusCls = confirmed
                      ? "bg-trail text-white"
                      : "bg-gold text-midnight";
                    return (
                      <Link
                        key={entry.entry_id}
                        href={href}
                        className="group block bg-white border border-stone/40 hover:border-midnight/30 transition-colors"
                      >
                        <div className="flex items-stretch">
                          {/* Date block */}
                          <div className="shrink-0 w-[4.75rem] bg-bone border-r border-stone/40 px-3 py-4 text-center flex flex-col justify-center">
                            <span className="sr-only">
                              {formatEventDate(entry.date, "long")}
                            </span>
                            <div aria-hidden>
                              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-dust">
                                {weekday}
                              </p>
                              <p
                                className={`font-mono text-2xl font-semibold tracking-tight leading-none mt-1 ${
                                  tbc ? "text-midnight/45" : ""
                                }`}
                              >
                                {day}
                              </p>
                              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-dust mt-1">
                                {month || "\u00A0"}
                              </p>
                            </div>
                          </div>
                          <div className="flex-1 min-w-0 px-4 sm:px-5 py-4 flex items-center justify-between gap-3">
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
                              {heat && (
                                <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-midnight mt-1.5">
                                  {heat}
                                </p>
                              )}
                              {action && (
                                <p className="text-xs font-medium text-terracotta mt-2">
                                  {action} <span aria-hidden>→</span>
                                </p>
                              )}
                            </div>
                            <span
                              className={`shrink-0 self-start text-[10px] font-medium uppercase tracking-wider px-2 py-1 ${statusCls}`}
                            >
                              {confirmed
                                ? entry.heat_number
                                  ? "Booked"
                                  : "Entered"
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
                    className="inline-flex items-center min-h-11 bg-midnight text-white text-sm font-medium px-5 py-2.5 hover:bg-midnight/90 transition-colors"
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

            {/* Album */}
            <PhotoAlbum initialPhotos={albumPhotos} />
          </div>

          {/* Sidebar */}
          <div className="space-y-8">
            <div id="profile" className="scroll-mt-24">
              <ProfileForm user={user} />
            </div>

            <PasswordCard hasPassword={user.hasPassword} />

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
