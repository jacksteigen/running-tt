import type { Metadata } from "next";
import Link from "next/link";
import { getDB } from "@/lib/db";
import { formatEventDate } from "@/lib/dates";
import { formatFee } from "@/lib/money";
import Reveal from "@/components/Reveal";
import {
  CATEGORY_LABEL,
  RACE_CATEGORIES,
  toPrizeSplit,
  toRaceCategory,
  type RaceCategory,
} from "@/lib/categories";

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
  is_test: number;
}

interface PodiumRow {
  event_id: string;
  rank: number;
  category_rank: number | null;
  race_category: string | null;
  prize_split: string | null;
  user_id: string;
  user_name: string;
  time_display: string;
  prize_amount_cents: number;
  verified: number;
}

/** One podium as it is shown: the overall top three, or one category's. */
interface Podium {
  category: RaceCategory | null;
  rows: { place: number; row: PodiumRow }[];
}

/**
 * The podiums to show for an event. A race paid by category shows the top
 * three women and the top three men; anything else, or a category race
 * where nobody had a category, shows the overall top three.
 */
function podiumsFor(rows: PodiumRow[]): Podium[] {
  if (rows.length > 0 && toPrizeSplit(rows[0].prize_split) === "category") {
    const byCategory = RACE_CATEGORIES.map((category) => ({
      category,
      rows: rows
        .filter(
          (r) =>
            toRaceCategory(r.race_category) === category &&
            r.category_rank !== null &&
            r.category_rank <= 3
        )
        .sort((a, b) => (a.category_rank as number) - (b.category_rank as number))
        .map((row) => ({ place: row.category_rank as number, row })),
    })).filter((p) => p.rows.length > 0);
    if (byCategory.length > 0) return byCategory;
  }
  const overall = rows
    .filter((r) => r.rank <= 3)
    .sort((a, b) => a.rank - b.rank)
    .map((row) => ({ place: row.rank, row }));
  return overall.length > 0 ? [{ category: null, rows: overall }] : [];
}

function formatDayMonth(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  const day = d.toLocaleDateString("en-AU", { day: "2-digit" });
  const month = d.toLocaleDateString("en-AU", { month: "short" }).toUpperCase();
  return { day, month };
}

function plural(n: number, one: string, many: string) {
  return n === 1 ? one : many;
}

export default async function ResultsPage() {
  const db = await getDB();

  // Past events (date has passed), most recent first.
  const past = await db
    .prepare("SELECT * FROM events WHERE date < date('now') ORDER BY date DESC")
    .all() as unknown as { results: EventRow[] };

  // All podium finishers across past events, in one query: the overall top
  // three, and the top three in each category for races paid by category.
  const podiums = await db
    .prepare(
      `SELECT r.event_id, r.rank, r.category_rank, r.race_category,
              r.time_display, r.prize_amount_cents, r.verified,
              u.id as user_id, u.name as user_name, ev.prize_split
       FROM results r
       JOIN users u ON r.user_id = u.id
       JOIN events ev ON r.event_id = ev.id
       WHERE r.rank <= 3 OR r.category_rank <= 3
       ORDER BY r.event_id, r.rank ASC`
    )
    .all() as unknown as { results: PodiumRow[] };

  const finishersByEvent = new Map<string, PodiumRow[]>();
  for (const p of podiums.results) {
    const list = finishersByEvent.get(p.event_id) ?? [];
    list.push(p);
    finishersByEvent.set(p.event_id, list);
  }

  // All-time records: fastest time per distance across every RTT result,
  // for women and men once categories are known at that distance. The
  // category is the one raced in, or the athlete's own for older results.
  interface RecordRow {
    time_display: string;
    time_seconds: number;
    verified: number;
    user_id: string;
    user_name: string;
    race_category: string | null;
    distance: string;
    event_name: string;
    event_slug: string;
    date: string;
  }
  const allTimes = await db
    .prepare(
      `SELECT r.time_display, r.time_seconds, r.verified,
              u.id as user_id, u.name as user_name,
              COALESCE(r.race_category, u.race_category) as race_category,
              ev.distance, ev.name as event_name, ev.slug as event_slug, ev.date
       FROM results r
       JOIN users u ON r.user_id = u.id
       JOIN events ev ON r.event_id = ev.id
       WHERE ev.is_test = 0
       ORDER BY r.time_seconds ASC`
    )
    .all() as unknown as { results: RecordRow[] };

  const recordOrder = ["Mile", "2K", "3K", "5K", "10K"];
  const fastestByDistance = new Map<string, RecordRow>();
  const fastestByCategory = new Map<string, Map<RaceCategory, RecordRow>>();
  for (const row of allTimes.results) {
    if (!fastestByDistance.has(row.distance)) {
      fastestByDistance.set(row.distance, row);
    }
    const category = toRaceCategory(row.race_category);
    if (!category) continue;
    const forDistance = fastestByCategory.get(row.distance) ?? new Map<RaceCategory, RecordRow>();
    if (!forDistance.has(category)) forDistance.set(category, row);
    fastestByCategory.set(row.distance, forDistance);
  }
  const records = recordOrder
    .filter((d) => fastestByDistance.has(d))
    .concat(
      [...fastestByDistance.keys()].filter((d) => !recordOrder.includes(d))
    )
    .map((distance) => {
      const top = fastestByDistance.get(distance) as RecordRow;
      const byCategory = fastestByCategory.get(distance);
      const rows: { category: RaceCategory | null; rec: RecordRow }[] = byCategory
        ? RACE_CATEGORIES.filter((c) => byCategory.has(c)).map((c) => ({
            category: c,
            rec: byCategory.get(c) as RecordRow,
          }))
        : [];
      // The fastest time ever stays on the board, even with no category on it.
      if (!toRaceCategory(top.race_category)) rows.unshift({ category: null, rec: top });
      return { distance, rows };
    });
  const recordsByCategory = records.some((r) => r.rows.some((row) => row.category));
  // A women's and a men's record at every distance, and nothing unlabelled.
  const recordsPaired =
    recordsByCategory &&
    records.every(
      (r) =>
        r.rows.every((row) => row.category) &&
        RACE_CATEGORIES.every((c) => r.rows.some((row) => row.category === c))
    );

  // Aggregate stats across past events
  // Test runs are listed but never counted toward Running TT totals or records.
  const totalRaces = past.results.filter((e) => !e.is_test).length;
  const totalFinishersRes = await db
    .prepare(
      "SELECT COUNT(*) as count FROM results r JOIN events ev ON r.event_id = ev.id WHERE ev.date < date('now') AND ev.is_test = 0"
    )
    .first<{ count: number }>();
  const totalPayoutRes = await db
    .prepare(
      "SELECT COALESCE(SUM(r.prize_amount_cents), 0) as total FROM results r JOIN events ev ON r.event_id = ev.id WHERE ev.date < date('now') AND ev.is_test = 0"
    )
    .first<{ total: number }>();

  const totalFinishers = totalFinishersRes?.count ?? 0;
  const paidCents = totalPayoutRes?.total ?? 0;
  const totalPaid = `$${(paidCents / 100).toLocaleString("en-AU", {
    minimumFractionDigits: paidCents % 100 ? 2 : 0,
    maximumFractionDigits: 2,
  })}`;

  // The archive reads year by year, most recent first.
  const years: { year: string; events: EventRow[] }[] = [];
  for (const event of past.results) {
    const year = event.date.slice(0, 4);
    const current = years[years.length - 1];
    if (current && current.year === year) current.events.push(event);
    else years.push({ year, events: [event] });
  }

  return (
    <>
      {/* Opener and the record book */}
      <section className="bg-midnight text-bone">
        <div className="mx-auto max-w-6xl px-6 pt-20 pb-24 md:pt-28 md:pb-32">
          <div className="max-w-5xl motion-safe:animate-fade-up">
            <h1 className="t-display text-[3rem] sm:text-[4rem] md:text-[4.8rem]">
              Every time, every podium,{" "}
              <br className="hidden md:inline" />
              <em className="text-bone/75">every dollar paid out.</em>
            </h1>
            <p className="t-lede mt-8 max-w-2xl text-bone/80">
              Running TT publishes the full leaderboard for every event. Times
              stay up forever. Past winners keep their records on the page.
            </p>
          </div>

          {totalRaces > 0 && (
            <p className="mt-14 md:mt-20 max-w-3xl border-t rule-light pt-6 text-[1.05rem] md:text-[1.15rem] leading-relaxed text-bone/70">
              So far:{" "}
              <span className="t-numeral text-[1.35em] text-bone">{totalRaces}</span>{" "}
              {plural(totalRaces, "race", "races")} run,{" "}
              <span className="t-numeral text-[1.35em] text-bone">{totalFinishers}</span>{" "}
              {plural(totalFinishers, "finisher", "finishers")} on the record, and{" "}
              <span className="t-numeral text-[1.35em] text-gold">{totalPaid}</span>{" "}
              paid out in prize money.
            </p>
          )}

          {records.length > 0 && (
            <div className="mt-20 md:mt-28 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12">
              <div className="lg:col-span-4">
                <h2 className="t-display text-[2.5rem] md:text-[3.3rem]">
                  Running TT <em className="text-gold">records</em>
                </h2>
                <p className="mt-5 max-w-xs text-bone/65 leading-relaxed">
                  {recordsPaired
                    ? "The fastest woman and the fastest man ever timed at a Running TT event, per distance."
                    : recordsByCategory
                      ? "The fastest times ever recorded at a Running TT event, per distance, by category where we know it."
                      : "Fastest time ever recorded at a Running TT event, per distance."}
                </p>
              </div>
              <div className="lg:col-span-8">
                <table className="w-full text-left">
                  <caption className="sr-only">
                    Running TT records: the fastest time recorded at a Running
                    TT event, per distance
                    {recordsPaired
                      ? ", for women and for men"
                      : recordsByCategory
                        ? ", by category where we know it"
                        : ""}
                  </caption>
                  <thead>
                    <tr className="border-b rule-light">
                      <th scope="col" className="text-left t-eyebrow text-bone/45 pb-3 pr-4">
                        Distance
                      </th>
                      <th scope="col" className="text-left t-eyebrow text-bone/45 pb-3 pr-4">
                        Time
                      </th>
                      <th scope="col" className="text-left t-eyebrow text-bone/45 pb-3">
                        Athlete
                      </th>
                    </tr>
                  </thead>
                  {/* One group per distance: a single record, or the women's and the men's. */}
                  {records.map(({ distance, rows }) => (
                    <tbody key={distance}>
                      {rows.map(({ category, rec }, i) => {
                        const last = i === rows.length - 1;
                        // Paired rows sit closer together, with the hairline under the pair.
                        const pad = `${i === 0 ? "pt-6 md:pt-7" : "pt-2 md:pt-3"} ${last ? "pb-6 md:pb-7" : "pb-2 md:pb-3"}`;
                        return (
                          <tr key={category ?? "overall"} className={last ? "border-b rule-light" : undefined}>
                            {i === 0 && (
                              <th
                                scope={rows.length > 1 ? "rowgroup" : "row"}
                                rowSpan={rows.length > 1 ? rows.length : undefined}
                                className={`text-left t-headline text-[1.35rem] md:text-[1.9rem] ${pad} pr-4 align-baseline`}
                              >
                                {distance}
                              </th>
                            )}
                            <td className={`${pad} pr-4 align-baseline whitespace-nowrap`}>
                              <span className="t-numeral text-[1.8rem] md:text-[2.6rem] text-gold">
                                {rec.time_display}
                              </span>
                            </td>
                            <td className={`${pad} align-baseline`}>
                              {category && (
                                <span className="t-eyebrow text-bone/50 mr-3">{CATEGORY_LABEL[category]}</span>
                              )}
                              <Link
                                href={`/athletes/${rec.user_id}`}
                                className="t-headline text-[1.15rem] md:text-[1.45rem] link-draw hover:text-gold transition-colors"
                              >
                                {rec.user_name}
                              </Link>
                              <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.88rem] text-bone/55">
                                <Link
                                  href={`/events/${rec.event_slug}`}
                                  className="link-quiet decoration-bone/30 hover:text-bone transition-colors"
                                >
                                  {rec.event_name}
                                </Link>
                                {rec.verified === 1 && (
                                  <span
                                    className="inline-flex items-center gap-1.5 t-eyebrow text-bone/60"
                                    title="Verified"
                                  >
                                    <span
                                      aria-hidden
                                      className="inline-block w-1.5 h-1.5 rounded-full bg-trail ring-1 ring-bone/40"
                                    />
                                    Verified
                                  </span>
                                )}
                              </p>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  ))}
                </table>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* The archive */}
      <Reveal>
        <section className="bg-bone">
          <div className="mx-auto max-w-6xl px-6 py-24 md:py-32">
            {past.results.length === 0 ? (
              <div className="max-w-2xl">
                <h2 className="t-display text-[2.6rem] md:text-[3.6rem]">
                  Awaiting the first start gun.
                </h2>
                <p className="t-lede mt-6 text-midnight/75">
                  Results from completed events will appear here. Every
                  finisher gets a time, a place and a page, and the times stay
                  up for good.
                </p>
                <Link href="/events" className="btn btn-primary mt-9">
                  See upcoming events
                </Link>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4 mb-14 md:mb-20">
                  <h2 className="t-display text-[2.8rem] md:text-[4.2rem]">
                    Past races
                  </h2>
                  <p className="t-caption text-[1rem] text-midnight/55 max-w-xs">
                    Thank you to everyone who has lined up.
                  </p>
                </div>

                <div className="space-y-16 md:space-y-20">
                  {years.map(({ year, events }) => (
                    <div
                      key={year}
                      className="grid grid-cols-1 lg:grid-cols-12 gap-x-12 gap-y-5"
                    >
                      <h3 className="lg:col-span-2 t-numeral text-[2.2rem] md:text-[2.8rem] text-dust lg:pt-8">
                        {year}
                      </h3>
                      <ol className="lg:col-span-10 border-t rule">
                        {events.map((event) => {
                          const { day, month } = formatDayMonth(event.date);
                          const eventPodiums = podiumsFor(finishersByEvent.get(event.id) ?? []);
                          const place = [event.venue, event.location]
                            .filter((v) => v && !/TBC/i.test(v))
                            .join(", ");
                          return (
                            <li key={event.id} className="border-b rule py-8 md:py-10">
                              <div className="grid grid-cols-[4.25rem_1fr] md:grid-cols-[5.5rem_1fr] xl:grid-cols-[5.5rem_1fr_21rem] gap-x-5 md:gap-x-8 gap-y-6">
                                <div className="text-midnight">
                                  <p className="t-numeral text-[2.6rem] md:text-[3.2rem]">{day}</p>
                                  <p className="t-eyebrow text-dust mt-1">{month}</p>
                                </div>

                                <div className="min-w-0">
                                  <p className="t-eyebrow text-terracotta">
                                    {event.distance}
                                    {event.is_test ? <span className="ml-3 text-dust">Test run</span> : null}
                                  </p>
                                  <h4 className="t-headline text-[1.6rem] md:text-[2.1rem] mt-2">
                                    <Link
                                      href={`/events/${event.slug}`}
                                      className="hover:text-terracotta transition-colors duration-300"
                                    >
                                      {event.name}
                                    </Link>
                                  </h4>
                                  <p className="mt-2 text-[0.95rem] text-midnight/60">
                                    {place ? `${place} · ` : ""}
                                    {formatEventDate(event.date, "long")}
                                  </p>
                                  <Link
                                    href={`/events/${event.slug}`}
                                    className="inline-block mt-2 py-2.5 link-quiet text-[0.95rem] text-midnight"
                                  >
                                    Full results
                                  </Link>
                                </div>

                                <div className="col-start-2 xl:col-start-3">
                                  {eventPodiums.length > 0 ? (
                                    <div className="space-y-6">
                                      {eventPodiums.map((podium) => (
                                        <div key={podium.category ?? "overall"}>
                                          {podium.category && (
                                            <p className="t-eyebrow text-dust mb-2.5">
                                              {CATEGORY_LABEL[podium.category]}
                                            </p>
                                          )}
                                          <ol
                                            className="border-t rule"
                                            aria-label={
                                              podium.category
                                                ? `${event.name} podium, ${CATEGORY_LABEL[podium.category]}`
                                                : `${event.name} podium`
                                            }
                                          >
                                            {podium.rows.map(({ place: pos, row: p }) => (
                                              <li
                                                key={`${pos}-${p.user_id}`}
                                                className="grid grid-cols-[1.75rem_1fr_auto] items-baseline gap-x-3 border-b rule py-3"
                                              >
                                                <span
                                                  className={`t-numeral text-[1.25rem] ${
                                                    pos === 1 ? "text-gold" : "text-midnight/45"
                                                  }`}
                                                >
                                                  {pos}
                                                </span>
                                                <Link
                                                  href={`/athletes/${p.user_id}`}
                                                  className="min-w-0 truncate text-[1rem] text-midnight link-draw hover:text-terracotta transition-colors"
                                                >
                                                  {p.user_name}
                                                </Link>
                                                <span className="text-right">
                                                  <span className="block t-numeral text-[1.25rem] text-midnight">
                                                    {p.time_display}
                                                  </span>
                                                  {p.prize_amount_cents > 0 && (
                                                    <span className="block t-numeral text-[0.9rem] text-dust mt-1">
                                                      {formatFee(p.prize_amount_cents)}
                                                    </span>
                                                  )}
                                                </span>
                                              </li>
                                            ))}
                                          </ol>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="t-caption text-[0.98rem] text-midnight/55">
                                      Full results on the event page.
                                    </p>
                                  )}
                                </div>
                              </div>
                            </li>
                          );
                        })}
                      </ol>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </section>
      </Reveal>
    </>
  );
}
