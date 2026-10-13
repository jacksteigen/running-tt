import { getDB } from "@/lib/db";
import { OUTCOMES, PUBLIC_OUTCOMES, type Outcome } from "@/lib/outcomes";
import { getSession } from "@/lib/auth";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import EnterEventButton from "@/components/EnterEventButton";
import Countdown from "@/components/Countdown";
import LiveRefresh from "@/components/LiveRefresh";
import HeatSchedule from "@/components/HeatSchedule";
import { displayStatus, todayInMelbourne } from "@/lib/events";
import { parsePrizes } from "@/lib/racetime";
import { AGE_GROUPS } from "@/lib/agegroups";
import { formatEventDate, isDateTbc } from "@/lib/dates";
import { getHeatAvailability, hasHeats, heatLabel, heatWindow, isValidClock } from "@/lib/heats";
import { bookingClosedReason, changeFeeText } from "@/lib/bookings";
import { formatFee } from "@/lib/money";

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
  change_fee_cents: number | null;
  first_heat_time: string | null;
  heat_interval_minutes: number | null;
  heat_count: number | null;
  heat_capacity: number | null;
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
      `${event.distance} time trial at ${event.venue}${
        isDateTbc(event.date) ? "" : ` on ${formatEventDate(event.date, "long")}`
      }. Enter on Running TT.`,
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

  // DNF and DQ are listed under the finishers; DNS stays private.
  const nonFinishers = (await db
    .prepare(
      `SELECT u.id as user_id, u.name, e.age_group, e.heat_number, e.outcome
       FROM entries e JOIN users u ON u.id = e.user_id
       WHERE e.event_id = ? AND e.status = 'confirmed'
         AND e.outcome IN (${PUBLIC_OUTCOMES.map(() => "?").join(", ")})
       ORDER BY e.outcome, u.name COLLATE NOCASE`
    )
    .bind(event.id, ...PUBLIC_OUTCOMES)
    .all()) as unknown as {
    results: {
      user_id: string;
      name: string;
      age_group: string | null;
      heat_number: number | null;
      outcome: Outcome;
    }[];
  };

  const avgTime = await db
    .prepare("SELECT AVG(time_seconds) as avg FROM results WHERE event_id = ?")
    .bind(event.id)
    .first<{ avg: number | null }>();

  const avgDisplay = avgTime?.avg
    ? `${Math.floor(avgTime.avg / 60)}:${String(Math.floor(avgTime.avg % 60)).padStart(2, "0")}`
    : "-";

  const session = await getSession(db);
  let myEntry: { id: string; heat_number: number | null } | null = null;
  if (session) {
    myEntry = await db
      .prepare(
        "SELECT id, heat_number FROM entries WHERE event_id = ? AND user_id = ? AND status = 'confirmed'"
      )
      .bind(event.id, session.user.id)
      .first<{ id: string; heat_number: number | null }>();
  }
  const alreadyEntered = !!myEntry;

  // Heat booking: events with heats are booked one heat at a time.
  const withHeats = hasHeats(event);
  const heats = withHeats ? await getHeatAvailability(db, event) : [];
  const closedReason = withHeats ? bookingClosedReason(event) : null;
  const timeWindow = withHeats ? heatWindow(event) : null;
  const bookHref = `/events/${event.slug}/book`;
  const bookedHref = `/events/${event.slug}/booked`;
  const myHeat = myEntry?.heat_number ? heatLabel(event, myEntry.heat_number) : "";
  const freeEntry = event.entry_fee_cents <= 0;
  const feeLabel = freeEntry ? "Free" : formatFee(event.entry_fee_cents);

  // Heats that have started (race day) are out of the running for spots.
  const heatsToRun = heats.filter((h) => !h.closed);
  const spotsLeft = heatsToRun.reduce((sum, h) => sum + h.remaining, 0);
  const someStarted = heatsToRun.length < heats.length;
  // Every heat still to run is full (or none are left to run).
  const allFull = heats.length > 0 && heats.every((h) => !h.bookable);
  const spotsCopy = someStarted
    ? `${spotsLeft} ${spotsLeft === 1 ? "spot" : "spots"} left in the ${
        heatsToRun.length === 1 ? "last heat" : `${heatsToRun.length} heats still to run`
      }.`
    : `${spotsLeft} of ${heats.length * (heats[0]?.capacity ?? 0)} spots left across ${heats.length} heats.`;
  const fullCopy = someStarted
    ? "Every heat still to run is full right now. Spots can free up as unfinished checkouts expire."
    : "Every heat is full right now. Spots can free up as unfinished checkouts expire.";

  // The first heat sets the countdown, not a generic morning start.
  const firstHeatTime = withHeats && isValidClock(event.first_heat_time) ? event.first_heat_time : null;

  const whatToBring: string[] = event.what_to_bring
    ? JSON.parse(event.what_to_bring)
    : [];

  // Status on the dark cover.
  const statusTone: Record<string, string> = {
    Open: "text-bone",
    "Sold Out": "text-terracotta",
    Completed: "text-bone/50",
    "Coming Soon": "text-bone/60",
  };

  const today = todayInMelbourne();
  const eventStatus = displayStatus(event.status, event.date);
  const isUpcoming = eventStatus === "Open" || eventStatus === "Coming Soon";
  const isRaceDay = event.date === today;
  const dateTbc = isDateTbc(event.date);
  // Closed for now (bookings will open) versus closed for good.
  const bookingsSoon =
    dateTbc ||
    (event.date >= today &&
      (event.status === "Coming Soon" || (withHeats && event.status === "Open" && !event.first_heat_time)));
  const closedCta = bookingsSoon
    ? "Booking opens soon"
    : event.date < today
      ? "Event finished"
      : event.status === "Sold Out"
        ? "Sold out"
        : "Bookings closed";
  // Bookings are open and this athlete has no heat yet.
  const bookingOpen = withHeats && isUpcoming && !closedReason && !myEntry;
  const canBook = bookingOpen && !allFull;

  // Age group standings, in band order, only for groups with a finisher.
  const groups = AGE_GROUPS.map((group) => ({
    group,
    rows: leaderboard.results.filter((r) => r.age_group === group),
  })).filter((g) => g.rows.length > 0);
  const ungrouped = leaderboard.results.filter((r) => !r.age_group);

  // The facts under the name, read across one line like a race programme.
  const entered = entryCount?.count ?? 0;
  const finishers = leaderboard.results.length;
  const place =
    [event.venue, event.location].filter((v) => v && !/TBC/i.test(v)).join(", ") ||
    "Venue to be announced";
  const when = timeWindow
    ? `Heats ${timeWindow}`
    : event.time
      ? /TBC/i.test(event.time)
        ? "Time TBC"
        : event.time
      : null;
  const facts = [
    place,
    when,
    freeEntry ? "Free entry" : `${feeLabel} entry`,
    entered > 0 ? `${entered} ${withHeats ? "booked" : "entered"}` : null,
  ].filter((f): f is string => !!f);

  const coverCaption = isRaceDay
    ? "Good luck to everyone on the start list today."
    : eventStatus === "Completed"
      ? "Thank you to everyone who lined up."
      : "Toe the line, hear the gun, run against the clock.";

  // Fee, heat changes and terms, said once near the entry action.
  const smallPrint = (onDark: boolean) => (
    <p className={`text-[0.8rem] leading-relaxed ${onDark ? "text-bone/55" : "text-midnight/55"}`}>
      {event.entry_fee_cents > 0
        ? `${feeLabel} AUD entry. Entry fees and sponsor cash fund the prize purse.`
        : "Free entry for this event."}{" "}
      {withHeats && `Heat changes are made by our team${changeFeeText(event.change_fee_cents)}. `}
      By entering you agree to the{" "}
      <Link
        href="/terms"
        className={`link-quiet transition-colors ${
          onDark ? "decoration-bone/40 hover:text-bone" : "hover:text-midnight"
        }`}
      >
        terms of entry
      </Link>
      .
    </p>
  );

  // Heat events book from the cover: the one primary action on the page.
  const heatBooking =
    withHeats && isUpcoming ? (
      <div className="mt-9">
        {myEntry ? (
          <>
            <p className="t-eyebrow text-gold">You are in</p>
            <p className="t-headline mt-2 text-[1.7rem] md:text-[2rem]">{myHeat}</p>
            <p className="mt-2 max-w-md text-[0.95rem] text-bone/70 leading-relaxed">
              Your ticket, calendar file and heat change requests all live on your booking.
            </p>
            <Link href={bookedHref} className="btn btn-light mt-6">
              View your booking
            </Link>
          </>
        ) : closedReason || allFull ? (
          <>
            <p className="t-headline text-[1.7rem] md:text-[2rem]">
              {closedReason ? closedCta : "Every heat is full"}
            </p>
            <p className="mt-2 max-w-md text-[0.95rem] text-bone/70 leading-relaxed">
              {closedReason ?? fullCopy}
            </p>
          </>
        ) : (
          <>
            <Link href={bookHref} className="btn btn-primary btn-lg">
              Book your heat · {feeLabel}
            </Link>
            <p className="mt-4 max-w-md text-[0.95rem] text-bone/75 leading-relaxed">
              {spotsCopy}{" "}
              {freeEntry ? "Pick your heat and you are in." : "Pick your heat, pay, and you are in."}
            </p>
          </>
        )}
        <div className="mt-5 max-w-md">{smallPrint(true)}</div>
      </div>
    ) : null;

  // Events without heats: the cover carries the action, and it jumps to the
  // entry panel below, where entering is one tap.
  const entryJump =
    isUpcoming && !withHeats && eventStatus === "Open" ? (
      <div className="mt-9">
        <a href="#enter" className="btn btn-primary btn-lg">
          Enter this race · {feeLabel}
        </a>
      </div>
    ) : null;

  // Events without heats enter in one tap, on paper below the cover.
  const entryPanel =
    isUpcoming && !withHeats ? (
      <div id="enter" className="scroll-mt-24">
        <h2 className="t-headline text-[2rem] md:text-[2.4rem]">
          {eventStatus === "Open" ? "Enter this race" : "Coming soon"}
        </h2>
        <p className="mt-3 max-w-md text-midnight/70 leading-relaxed">
          {eventStatus === "Open"
            ? `${entered} ${entered === 1 ? "athlete has" : "athletes have"} locked in. Rolling heats, so get in early.`
            : "Entries will open soon."}
        </p>
        <div className="mt-6 max-w-sm">
          <EnterEventButton
            eventId={event.id}
            eventSlug={event.slug}
            eventStatus={eventStatus}
            entryFeeCents={event.entry_fee_cents}
            isLoggedIn={!!session}
            profileCompleted={!!session?.user.profileCompleted}
            alreadyEntered={alreadyEntered}
          />
        </div>
        <div className="mt-5 max-w-sm">{smallPrint(false)}</div>
      </div>
    ) : null;

  // About the race. Beside the entry panel it stacks; on its own it takes
  // the same heading-left, words-right split as the sections below.
  const aboutHeading = (
    <h2 className="t-display text-[2.6rem] md:text-[3.6rem]">
      About the <em>race</em>
    </h2>
  );
  const aboutDetails =
    event.check_in || whatToBring.length > 0 ? (
      <div className="mt-10 md:mt-12 grid grid-cols-1 sm:grid-cols-2 gap-10 border-t rule pt-8">
        {event.check_in && (
          <div>
            <h3 className="text-[1.25rem] md:text-[1.4rem]">On the day</h3>
            <p className="mt-3 text-midnight/70 leading-relaxed">{event.check_in}</p>
          </div>
        )}
        {whatToBring.length > 0 && (
          <div>
            <h3 className="text-[1.25rem] md:text-[1.4rem]">What to bring</h3>
            <ul className="mt-2">
              {whatToBring.map((item) => (
                <li key={item} className="border-b rule py-2.5 text-midnight/75 last:border-b-0">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    ) : null;
  const aboutBody = (
    <>
      <p className="t-lede max-w-2xl text-midnight/80">{event.description}</p>
      {aboutDetails}
    </>
  );

  // Heats lead while the event is ahead, then step aside for the results.
  const heatsFirst = leaderboard.results.length === 0 && eventStatus !== "Completed";

  // Sections alternate bone, stone and midnight; a hairline separates two
  // bone sections that meet.
  const introAtEnd = !heatsFirst;
  const introRuled = introAtEnd && !withHeats && eventPrizes.length === 0;
  const introSection =
    event.description || entryPanel ? (
      <section className="bg-bone">
        <div className="mx-auto max-w-6xl px-6">
          <div
            className={`grid grid-cols-1 lg:grid-cols-12 py-24 md:py-32 ${
              entryPanel ? "gap-14 lg:gap-16" : "gap-8 lg:gap-12"
            } ${introRuled ? "border-t rule" : ""}`}
          >
            {event.description &&
              (entryPanel ? (
                <div className="lg:col-span-7">
                  {aboutHeading}
                  <div className="mt-6">{aboutBody}</div>
                </div>
              ) : (
                <>
                  <div className="lg:col-span-4">{aboutHeading}</div>
                  <div className="lg:col-span-8 lg:pt-3">{aboutBody}</div>
                </>
              ))}
            {entryPanel && (
              <div
                className={
                  event.description
                    ? "lg:col-span-5 order-first lg:order-none border-b rule pb-14 lg:border-b-0 lg:pb-0 lg:border-l lg:pl-12"
                    : "lg:col-span-6"
                }
              >
                {entryPanel}
              </div>
            )}
          </div>
        </div>
      </section>
    ) : null;

  const heatsSection = withHeats ? (
    <section className="bg-stone">
      <div className="mx-auto max-w-6xl px-6 py-24 md:py-32">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12">
          <div className="lg:col-span-4">
            <h2 className="t-display text-[2.6rem] md:text-[3.6rem]">
              The heats
            </h2>
            <p className="mt-5 max-w-sm text-midnight/70 leading-relaxed">
              A rolling start. Small heats go off one after another through
              the window, so every runner is seen.
            </p>
            {canBook ? (
              <Link
                href={bookHref}
                className="mt-5 inline-flex min-h-11 items-center link-quiet text-midnight"
              >
                Choose your heat
              </Link>
            ) : bookingOpen && allFull ? (
              <p className="mt-6 t-eyebrow text-midnight/50">Heats full</p>
            ) : null}
          </div>
          <div className="lg:col-span-8">
            <HeatSchedule
              heats={heats}
              timeWindow={timeWindow}
              bookHref={canBook ? bookHref : null}
              showSpots={isUpcoming}
            />
          </div>
        </div>
      </div>
    </section>
  ) : null;

  const prizeSection =
    eventPrizes.length > 0 ? (
      <section className="bg-midnight text-bone">
        <div className="mx-auto max-w-6xl px-6 py-24 md:py-32">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12">
            <div className="lg:col-span-4">
              <h2 className="t-display text-[2.6rem] md:text-[3.6rem]">
                Prize money
              </h2>
              <p className="mt-5 max-w-xs text-bone/70 leading-relaxed">
                Handed out on the day, at the finish.
              </p>
            </div>
            <dl className="lg:col-span-8 border-t rule-light">
              {eventPrizes.map((prize, i) => (
                <div
                  key={prize.label}
                  className="flex items-baseline justify-between gap-6 border-b rule-light py-5 md:py-6"
                >
                  <dt className="t-headline text-[1.3rem] md:text-[1.6rem] text-bone/85">
                    {prize.label}
                  </dt>
                  <dd
                    className={`t-numeral text-[2.2rem] md:text-[3rem] ${
                      i === 0 ? "text-gold" : "text-bone"
                    }`}
                  >
                    {prize.amount}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>
    ) : null;

  // The results board. A hairline sits on top when it follows another bone
  // section directly.
  const resultsRuled = heatsFirst && !withHeats && eventPrizes.length === 0 && !!introSection;
  const fastest = leaderboard.results[0]?.time_display;
  const cell = "py-4 md:py-5 align-baseline";
  const resultsSection = (
    <section className="bg-bone">
      <div className="mx-auto max-w-6xl px-6">
        <div className={`py-24 md:py-32 ${resultsRuled ? "border-t rule" : ""}`}>
          <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-5 mb-10 md:mb-12">
            <h2 className="t-display text-[2.8rem] md:text-[4.2rem]">Results</h2>
            <ul className="flex flex-wrap items-baseline gap-x-7 gap-y-2 text-[0.95rem] text-midnight/60">
              <li>
                <span className="t-numeral text-[1.4rem] text-midnight mr-1.5">{entered}</span>
                entered
              </li>
              {finishers > 0 && (
                <li>
                  <span className="t-numeral text-[1.4rem] text-midnight mr-1.5">{finishers}</span>
                  {finishers === 1 ? "finisher" : "finishers"}
                </li>
              )}
              {fastest ? (
                <li>
                  <span className="t-numeral text-[1.4rem] text-midnight mr-1.5">{fastest}</span>
                  fastest
                </li>
              ) : event.course_record ? (
                <li>
                  <span className="t-numeral text-[1.4rem] text-midnight mr-1.5">
                    {event.course_record}
                  </span>
                  course record{event.course_record_holder ? `, ${event.course_record_holder}` : ""}
                </li>
              ) : null}
              {finishers > 0 && avgTime?.avg ? (
                <li>
                  <span className="t-numeral text-[1.4rem] text-midnight mr-1.5">{avgDisplay}</span>
                  average
                </li>
              ) : null}
            </ul>
          </div>

          {leaderboard.results.length > 0 ? (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-t rule">
                  <caption className="sr-only">Overall results for {event.name}</caption>
                  <thead>
                    <tr className="border-b rule">
                      <th scope="col" className="t-eyebrow text-dust py-3 pr-4 w-12 md:w-20">
                        Pos
                      </th>
                      <th scope="col" className="t-eyebrow text-dust py-3 pr-4">
                        Athlete
                      </th>
                      <th scope="col" className="t-eyebrow text-dust py-3 pr-4 hidden sm:table-cell">
                        Age group
                      </th>
                      <th scope="col" className="t-eyebrow text-dust py-3 pr-4 hidden md:table-cell w-20">
                        Heat
                      </th>
                      <th scope="col" className="t-eyebrow text-dust py-3 text-right">
                        Time
                      </th>
                      <th scope="col" className="t-eyebrow text-dust py-3 pl-6 hidden sm:table-cell w-28 text-right">
                        Prize
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboard.results.map((entry) => {
                      const rankColor =
                        entry.rank === 1
                          ? "text-gold"
                          : entry.rank <= 3
                            ? "text-midnight"
                            : "text-midnight/40";
                      const prize =
                        entry.prize_amount_cents > 0 ? formatFee(entry.prize_amount_cents) : null;
                      return (
                        <tr key={entry.user_id} className="border-b rule">
                          <td className={`${cell} pr-4`}>
                            <span className={`t-numeral text-[1.6rem] md:text-[2rem] ${rankColor}`}>
                              {entry.rank}
                            </span>
                          </td>
                          <td className={`${cell} pr-4`}>
                            <Link
                              href={`/athletes/${entry.user_id}`}
                              className="t-headline text-[1.2rem] md:text-[1.5rem] hover:text-terracotta transition-colors duration-300"
                            >
                              {entry.name}
                            </Link>
                            {(entry.age_group || prize) && (
                              <span className="sm:hidden block mt-1 text-[0.8rem] text-midnight/55">
                                {[entry.age_group, prize].filter(Boolean).join(" · ")}
                              </span>
                            )}
                          </td>
                          <td className={`${cell} pr-4 hidden sm:table-cell text-[0.95rem] text-midnight/65`}>
                            {entry.age_group ?? "-"}
                            {entry.age_group_rank === 1 && (
                              <span className="t-eyebrow ml-2.5 inline-flex items-center gap-1.5 text-midnight/70">
                                <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-gold" />
                                1st
                              </span>
                            )}
                          </td>
                          <td className={`${cell} pr-4 hidden md:table-cell`}>
                            <span className="t-numeral text-[1.05rem] text-dust">H{entry.heat_number}</span>
                          </td>
                          <td className={`${cell} text-right`}>
                            <span className="t-numeral text-[1.4rem] md:text-[1.8rem]">
                              {entry.time_display}
                            </span>
                          </td>
                          <td className={`${cell} pl-6 text-right hidden sm:table-cell`}>
                            {prize ? (
                              <span className="t-numeral text-[1.15rem] md:text-[1.3rem]">{prize}</span>
                            ) : (
                              <span className="text-midnight/30">-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {nonFinishers.results.map((nf) => (
                      <tr key={nf.user_id} className="border-b rule">
                        <td className={`${cell} pr-4 text-midnight/30`}>-</td>
                        <td className={`${cell} pr-4`}>
                          <Link
                            href={`/athletes/${nf.user_id}`}
                            className="t-headline text-[1.2rem] md:text-[1.5rem] text-midnight/60 hover:text-terracotta transition-colors duration-300"
                          >
                            {nf.name}
                          </Link>
                          {nf.age_group && (
                            <span className="sm:hidden block mt-1 text-[0.8rem] text-midnight/50">
                              {nf.age_group}
                            </span>
                          )}
                        </td>
                        <td className={`${cell} pr-4 hidden sm:table-cell text-[0.95rem] text-midnight/50`}>
                          {nf.age_group ?? "-"}
                        </td>
                        <td className={`${cell} pr-4 hidden md:table-cell`}>
                          <span className="t-numeral text-[1.05rem] text-dust">
                            {nf.heat_number ? `H${nf.heat_number}` : "-"}
                          </span>
                        </td>
                        <td className={`${cell} text-right`} title={OUTCOMES[nf.outcome].name}>
                          <span className="t-eyebrow text-[0.8rem] text-midnight/55">
                            {OUTCOMES[nf.outcome].label}
                          </span>
                        </td>
                        <td className={`${cell} pl-6 text-right hidden sm:table-cell text-midnight/30`}>-</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {nonFinishers.results.length > 0 && (
                <p className="mt-4 t-caption text-midnight/55">
                  {PUBLIC_OUTCOMES.filter((o) => nonFinishers.results.some((n) => n.outcome === o))
                    .map((o) => `${OUTCOMES[o].label}: ${OUTCOMES[o].name.toLowerCase()}`)
                    .join(" · ")}
                </p>
              )}
            </>
          ) : (
            <div className="border-y rule py-12 md:py-14">
              <p className="t-headline text-[1.6rem] md:text-[2rem] max-w-2xl">
                {isRaceDay
                  ? "Times go up here as each heat finishes."
                  : eventStatus === "Completed"
                    ? "Times are being finalised."
                    : "Times go up here the moment they are recorded."}
              </p>
              <p className="mt-3 max-w-md text-midnight/60 leading-relaxed">
                {isRaceDay
                  ? "Race day. Check back as the heats run."
                  : eventStatus === "Completed"
                    ? "Results are pending. Every finisher will have a time, a place and a page."
                    : "Awaiting the start. Every finisher gets a time, a place and a page."}
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );

  const ageGroupSection =
    groups.length > 0 ? (
      <section className="bg-bone">
        <div className="mx-auto max-w-6xl px-6">
          <div className="border-t rule py-24 md:py-32">
            <h2 className="t-display text-[2.4rem] md:text-[3.4rem]">
              Age groups
            </h2>
            <div className="mt-10 md:mt-14 grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-14">
              {groups.map(({ group, rows }) => (
                <div key={group}>
                  <div className="flex items-baseline justify-between gap-4 pb-3">
                    <h3 className="t-headline text-[1.45rem] md:text-[1.7rem]">{group}</h3>
                    <p className="t-eyebrow text-dust">
                      {rows.length} {rows.length === 1 ? "finisher" : "finishers"}
                    </p>
                  </div>
                  <ol className="border-t rule">
                    {rows.map((r) => (
                      <li key={r.user_id} className="border-b rule">
                        <Link
                          href={`/athletes/${r.user_id}`}
                          className="group grid grid-cols-[2.25rem_1fr_auto] items-baseline gap-4 py-3.5 min-h-12"
                        >
                          <span
                            className={`t-numeral text-[1.25rem] ${
                              r.age_group_rank === 1 ? "text-gold" : "text-midnight/40"
                            }`}
                          >
                            {r.age_group_rank}
                          </span>
                          <span className="t-headline text-[1.15rem] md:text-[1.25rem] truncate group-hover:text-terracotta transition-colors duration-300">
                            {r.name}
                          </span>
                          <span className="t-numeral text-[1.25rem]">{r.time_display}</span>
                        </Link>
                      </li>
                    ))}
                  </ol>
                </div>
              ))}
            </div>
            {ungrouped.length > 0 && (
              <p className="mt-10 t-caption text-midnight/55">
                {ungrouped.length} finisher{ungrouped.length === 1 ? "" : "s"} without a
                date of birth on file {ungrouped.length === 1 ? "is" : "are"} shown in the
                overall results only.
              </p>
            )}
          </div>
        </div>
      </section>
    ) : null;

  return (
    <>
      {/* Cover */}
      <section className="relative bg-midnight text-bone overflow-hidden">
        {/* Phones: the photo sits behind the type. Desktop: it takes the
            right side, like the home page, so the type never sits on it. */}
        <div aria-hidden className="absolute inset-0 lg:left-[52%] overflow-hidden">
          <Image
            src="/images/athlete-track-side.jpg"
            alt=""
            fill
            priority
            sizes="(min-width: 1024px) 48vw, 100vw"
            className="object-cover object-[50%_30%] opacity-40 lg:opacity-90 motion-safe:animate-slow-zoom"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-midnight via-midnight/40 to-midnight/0" />
          <div className="absolute inset-0 hidden lg:block bg-gradient-to-r from-midnight via-midnight/10 to-transparent w-1/3" />
        </div>
        <div aria-hidden className="absolute inset-0 lg:hidden bg-gradient-to-r from-midnight/70 via-midnight/30 to-transparent" />

        <div className="relative mx-auto max-w-6xl px-6 pt-6 pb-12 md:pb-16 lg:min-h-[86vh] flex flex-col">
          <Link
            href="/events"
            className="self-start inline-flex min-h-11 items-center t-eyebrow text-bone/60 hover:text-bone transition-colors"
          >
            All races
          </Link>

          <div className="mt-14 md:mt-20 lg:mt-auto lg:pt-16 max-w-3xl lg:max-w-[48%] motion-safe:animate-fade-up">
            <p className="t-eyebrow flex flex-wrap items-center gap-x-4 gap-y-2 text-bone/60">
              <span>{event.distance}</span>
              <span className={statusTone[eventStatus] ?? "text-bone/60"}>{eventStatus}</span>
              {isRaceDay && leaderboard.results.length > 0 && <LiveRefresh />}
            </p>
            <h1 className="t-display mt-5 break-words text-[3.2rem] sm:text-[4.2rem] md:text-[5.2rem] lg:text-[clamp(4rem,5.2vw,5.6rem)]">
              {event.name}
            </h1>
            <p className="t-lede mt-5 text-bone/85">
              <em>{dateTbc ? "Date to be announced" : formatEventDate(event.date, "long")}</em>
            </p>
            <ul className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-[0.95rem] text-bone/80">
              {facts.map((fact) => (
                <li key={fact}>{fact}</li>
              ))}
            </ul>

            {heatBooking}
            {entryJump}
          </div>

          <div className="mt-14 md:mt-16 flex flex-col md:flex-row md:items-end md:justify-between gap-8 border-t rule-light pt-6 motion-safe:animate-fade-up [animation-delay:200ms]">
            <p className="t-caption text-bone/60 max-w-xs">{coverCaption}</p>

            {isUpcoming && !isRaceDay && !dateTbc && (
              <div>
                <p className="t-eyebrow text-bone/60 mb-4">
                  {firstHeatTime ? "First heat in" : "Start gun in"}
                </p>
                <Countdown target={event.date} time={firstHeatTime} className="text-bone" />
              </div>
            )}
            {isUpcoming && dateTbc && (
              <div className="max-w-xs">
                <p className="t-eyebrow text-bone/60">Start gun</p>
                <p className="t-headline mt-3 text-[2rem] md:text-[2.4rem]">To be announced.</p>
                <p className="mt-3 text-[0.95rem] text-bone/70 leading-relaxed">
                  The date is being locked in. {withHeats ? "Heat booking" : "Entry"} opens once it is set.
                </p>
              </div>
            )}
            {isRaceDay && (
              <div>
                <p className="t-eyebrow text-terracotta">Race day</p>
                <p className="t-headline mt-3 text-[2rem] md:text-[2.4rem]">
                  Today, {timeWindow ?? event.time}
                </p>
                <p className="mt-2 text-bone/70">{event.venue}</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {heatsFirst ? (
        <>
          {introSection}
          {heatsSection}
          {prizeSection}
          {resultsSection}
        </>
      ) : (
        <>
          {resultsSection}
          {ageGroupSection}
          {prizeSection}
          {heatsSection}
          {introSection}
        </>
      )}
    </>
  );
}
