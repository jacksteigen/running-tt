import { getDB } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
import Link from "next/link";
import type { Metadata } from "next";
import type { ReactNode } from "react";
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

/** "a, b and c", keeping each part's markup. */
function inSentence(parts: ReactNode[]): ReactNode[] {
  return parts.flatMap((part, i) => {
    if (i === 0) return [part];
    return [i === parts.length - 1 ? " and " : ", ", part];
  });
}

/** A number set in race-bib figures inside a serif sentence. */
function Figure({ children, className = "text-bone" }: { children: ReactNode; className?: string }) {
  return <span className={`t-numeral text-[1.08em] ${className}`}>{children}</span>;
}

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

  const firstName = user.firstName?.trim() || user.name.split(" ")[0];

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

  // Summary stats, told as a sentence rather than a row of boxes.
  const upcomingConfirmed = upcomingEntries.filter((e) => e.status === "confirmed").length;
  const totalRaces = results.results.length;
  const podiums = results.results.filter((r) => r.rank <= 3).length;
  const earnings = results.results.reduce(
    (sum, r) => sum + (r.prize_amount_cents || 0),
    0
  );
  const record: ReactNode[] = [];
  if (upcomingConfirmed > 0) {
    record.push(
      <span key="upcoming">
        <Figure>{upcomingConfirmed}</Figure> {upcomingConfirmed === 1 ? "race" : "races"} coming up
      </span>
    );
  }
  if (totalRaces > 0) {
    record.push(
      <span key="races">
        <Figure>{totalRaces}</Figure> on the clock
      </span>
    );
  }
  if (podiums > 0) {
    record.push(
      <span key="podiums">
        <Figure>{podiums}</Figure> {podiums === 1 ? "podium" : "podiums"}
      </span>
    );
  }
  if (earnings > 0) {
    record.push(
      <span key="earned">
        <Figure className="text-gold">{formatFee(earnings)}</Figure> in prize money
      </span>
    );
  }

  return (
    <>
      {/* Greeting */}
      <section className="bg-midnight text-bone">
        <div className="mx-auto max-w-6xl px-6 pt-14 pb-12 md:pt-24 md:pb-16">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8">
            <div className="min-w-0 motion-safe:animate-fade-up">
              <h1 className="t-display text-[2.9rem] sm:text-[4rem] md:text-[5rem] break-words">
                Good to see you, <em className="text-bone/75">{firstName}.</em>
              </h1>
              <p className="mt-4 text-[0.95rem] text-bone/55 break-all">{user.email}</p>
            </div>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 shrink-0">
              <Link
                href={`/athletes/${user.id}`}
                className="link-draw inline-block py-3 text-[0.95rem] text-bone/80 hover:text-bone transition-colors"
              >
                Public profile
              </Link>
              <Link
                href="#profile"
                className="link-draw inline-block py-3 text-[0.95rem] text-bone/80 hover:text-bone transition-colors"
              >
                Edit profile
              </Link>
              {user.isAdmin && (
                <Link
                  href="/admin"
                  className="link-draw inline-block py-3 text-[0.95rem] text-terracotta hover:text-bone transition-colors"
                >
                  Admin
                </Link>
              )}
              <LogoutButton />
            </div>
          </div>

          <p className="mt-12 md:mt-16 border-t rule-light pt-6 t-headline text-[1.35rem] md:text-[1.8rem] text-bone/70 max-w-4xl">
            {record.length > 0 ? (
              <>{inSentence(record)}.</>
            ) : (
              <>Nothing on the clock yet. Your first race is waiting.</>
            )}
          </p>
        </div>
      </section>

      {(sp.welcome || sp.entered) && (
        <section className="bg-trail text-bone" role="status">
          <div className="mx-auto max-w-6xl px-6 py-4 flex items-center gap-3">
            <span aria-hidden className="inline-block w-1.5 h-1.5 rounded-full bg-bone/80 shrink-0" />
            <p className="text-[0.95rem]">
              {sp.entered
                ? "You are in. Your entry is confirmed and your spot on the start list is locked."
                : `Welcome to Running TT, ${user.firstName ?? user.name}. Your profile is live.`}
            </p>
          </div>
        </section>
      )}

      {/* Next race */}
      {soonestUpcoming && spotlight && (
        <section className="bg-terracotta text-bone">
          <div className="mx-auto max-w-6xl px-6 py-14 md:py-20">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-end">
              <div className="lg:col-span-7">
                <p className="t-eyebrow text-bone/75">
                  {spotlight.pending ? "Finish your booking" : "Your next race"}
                  {soonestUpcoming.distance ? `, ${soonestUpcoming.distance}` : ""}
                </p>
                <h2 className="t-display mt-4 text-[2.6rem] md:text-[3.8rem]">
                  {soonestUpcoming.name}
                </h2>
                <p className="t-lede mt-4 text-bone/90">
                  <em>
                    {spotlight.tbc
                      ? "Date to be announced"
                      : formatEventDate(soonestUpcoming.date, "long")}
                  </em>
                  , {soonestUpcoming.venue}
                </p>
                {!spotlight.pending && (
                  <ul className="mt-6 flex flex-wrap items-baseline gap-x-6 gap-y-2 text-[0.95rem] text-bone/85">
                    {soonestUpcoming.heat_number && (
                      <li className="text-bone">
                        {heatLabel(soonestUpcoming, soonestUpcoming.heat_number)}
                      </li>
                    )}
                    <li>
                      Ref <span className="t-numeral text-[1.05em]">{bookingRef(soonestUpcoming.entry_id)}</span>
                    </li>
                  </ul>
                )}
                {spotlight.action && (
                  <div className="mt-8">
                    <Link
                      href={spotlight.href}
                      className="btn btn-bone btn-lg"
                    >
                      {spotlight.action}
                    </Link>
                  </div>
                )}
              </div>
              <div className="lg:col-span-5 border-t border-bone/25 pt-8 lg:border-t-0 lg:pt-0 lg:border-l lg:pl-12">
                {spotlight.tbc ? (
                  <>
                    <p className="t-headline text-[1.9rem] md:text-[2.3rem]">
                      {spotlight.pending ? "Bookings open soon." : "Your spot is held."}
                    </p>
                    <p className="mt-3 text-[0.95rem] text-bone/85 leading-relaxed max-w-sm">
                      {spotlight.pending
                        ? "Bookings open once the date is locked in. The date and heat times land here first."
                        : "The date and your heat time land here as soon as they are locked in."}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="t-eyebrow text-bone/70 mb-4">
                      {spotlight.countdown.label}
                    </p>
                    <Countdown
                      target={soonestUpcoming.date}
                      time={spotlight.countdown.time}
                      className="text-bone"
                    />
                  </>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Entries */}
      <section className="bg-bone">
        <div className="mx-auto max-w-6xl px-6 py-20 md:py-28">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12">
            <div className="lg:col-span-4">
              <h2 className="t-display text-[2.6rem] md:text-[3.6rem]">
                Your <em>races</em>
              </h2>
              {entries.results.length > 0 && (
                <Link href="/events" className="inline-block mt-5 link-quiet text-midnight">
                  Find another race
                </Link>
              )}
            </div>
            <div className="lg:col-span-8">
              {entries.results.length > 0 ? (
                <ol className="border-t rule">
                  {entries.results.map((entry) => {
                    const { day, month, weekday, tbc } = dateParts(entry.date);
                    const { href, action } = entryLink(entry);
                    const confirmed = entry.status === "confirmed";
                    const heat = confirmed ? heatLabel(entry, entry.heat_number) : "";
                    return (
                      <li key={entry.entry_id} className="border-b rule">
                        <Link
                          href={href}
                          className="group grid grid-cols-[4rem_1fr] md:grid-cols-[5rem_1fr_auto] items-center gap-x-5 md:gap-x-8 py-6 md:py-7"
                        >
                          <div className="text-midnight">
                            <span className="sr-only">
                              {formatEventDate(entry.date, "long")}
                            </span>
                            <div aria-hidden>
                              <p className="t-eyebrow text-dust">{weekday}</p>
                              <p
                                className={`t-numeral text-[2.3rem] md:text-[2.8rem] mt-1 ${
                                  tbc ? "text-midnight/45" : ""
                                }`}
                              >
                                {day}
                              </p>
                              <p className="t-eyebrow text-dust mt-1">
                                {month || "\u00A0"}
                              </p>
                            </div>
                          </div>
                          <div className="min-w-0">
                            <p className="t-eyebrow text-terracotta">
                              {entry.distance}
                              <span className={`ml-3 ${confirmed ? "text-trail" : "text-dust"}`}>
                                {confirmed
                                  ? entry.heat_number
                                    ? "Booked"
                                    : "Entered"
                                  : "Pending"}
                              </span>
                            </p>
                            <h3 className="t-headline text-[1.5rem] md:text-[1.9rem] mt-2 group-hover:text-terracotta transition-colors duration-300">
                              {entry.name}
                            </h3>
                            <p className="mt-1.5 text-[0.95rem] text-midnight/60">
                              {entry.venue}
                              {heat && <span className="text-midnight"> · {heat}</span>}
                            </p>
                          </div>
                          {action && (
                            <div className="col-start-2 md:col-start-3 mt-3 md:mt-0">
                              <span
                                className={`link-draw text-[0.95rem] ${
                                  confirmed ? "text-midnight" : "text-terracotta"
                                }`}
                              >
                                {action}
                              </span>
                            </div>
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ol>
              ) : (
                <div className="border-t rule pt-6">
                  <p className="max-w-md text-[1.05rem] text-midnight/70 leading-relaxed">
                    You have not entered a race yet. When you do, it lands here
                    with your heat and booking reference.
                  </p>
                  <Link href="/events" className="btn btn-primary mt-7">
                    Find a race
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Results and personal bests */}
      <section className="bg-midnight text-bone">
        <div className="mx-auto max-w-6xl px-6 py-20 md:py-28">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12">
            <div className="lg:col-span-4">
              <h2 className="t-display text-[2.6rem] md:text-[3.6rem]">
                On the clock
              </h2>
              <p className="mt-5 max-w-xs text-bone/65 leading-relaxed">
                {totalRaces > 0
                  ? "Every time you have run with us, kept on your public page."
                  : "Your times and personal bests land here, and on your public page."}
              </p>
            </div>
            <div className="lg:col-span-8 space-y-16">
              {pbs.results.length > 0 && (
                <div>
                  <h3 className="t-headline text-[1.5rem] md:text-[1.8rem]">Personal bests</h3>
                  <dl className="mt-6 border-t rule-light">
                    {pbs.results.map((pb) => (
                      <PBCard
                        key={pb.distance}
                        distance={pb.distance}
                        time={pb.time_display}
                        verified={pb.verified === 1}
                        tone="dark"
                      />
                    ))}
                  </dl>
                </div>
              )}
              <div>
                <h3 className="t-headline text-[1.5rem] md:text-[1.8rem]">Race results</h3>
                <div className="mt-6">
                  <ResultsTable
                    rows={results.results}
                    tone="dark"
                    empty={
                      <p className="max-w-md text-bone/70 leading-relaxed">
                        No results yet. Your time lands here as soon as it is
                        posted after your first race.
                      </p>
                    }
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Profile, album and account */}
      <section id="profile" className="bg-stone scroll-mt-16">
        <div className="mx-auto max-w-6xl px-6 py-20 md:py-28">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12">
            <div className="lg:col-span-4">
              <div className="lg:sticky lg:top-28">
                <h2 className="t-display text-[2.6rem] md:text-[3.6rem]">
                  Your page
                </h2>
                <p className="mt-5 max-w-xs text-midnight/70 leading-relaxed">
                  Your photo, your story and your album, as other runners and
                  sponsors see them.
                </p>
                <Link
                  href={`/athletes/${user.id}`}
                  className="inline-block mt-5 link-quiet text-midnight"
                >
                  See your public profile
                </Link>
              </div>
            </div>
            <div className="lg:col-span-8 space-y-8">
              <ProfileForm user={user} />

              <PhotoAlbum initialPhotos={albumPhotos} />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <PasswordCard hasPassword={user.hasPassword} />

                {/* Connected accounts: not live yet, so said plainly rather than a dead button. */}
                <div>
                  <h3 className="t-headline text-[1.5rem]">Connected accounts</h3>
                  <ul className="mt-5 border-t rule">
                    <li className="flex items-center justify-between gap-4 py-4 border-b rule">
                      <div>
                        <p className="text-[0.95rem] text-midnight">Strava</p>
                        <p className="text-[0.85rem] text-midnight/55 mt-0.5">
                          Auto-import activities
                        </p>
                      </div>
                      {user.stravaAthleteId ? (
                        <span className="t-eyebrow text-trail inline-flex items-center gap-2">
                          <span aria-hidden className="inline-block w-1.5 h-1.5 rounded-full bg-trail" />
                          Connected
                        </span>
                      ) : (
                        <span className="t-caption text-midnight/50">Coming soon</span>
                      )}
                    </li>
                    <li className="flex items-center justify-between gap-4 py-4 border-b rule">
                      <div>
                        <p className="text-[0.95rem] text-midnight">Garmin</p>
                        <p className="text-[0.85rem] text-midnight/55 mt-0.5">
                          Verify times via GPS
                        </p>
                      </div>
                      {user.garminUserId ? (
                        <span className="t-eyebrow text-trail inline-flex items-center gap-2">
                          <span aria-hidden className="inline-block w-1.5 h-1.5 rounded-full bg-trail" />
                          Connected
                        </span>
                      ) : (
                        <span className="t-caption text-midnight/50">Coming soon</span>
                      )}
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
