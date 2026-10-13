import Link from "next/link";
import type { ReactNode } from "react";
import { formatFee } from "@/lib/money";
import {
  CATEGORY_LABEL,
  CATEGORY_NOUN,
  ordinal,
  placeFor,
  toPrizeSplit,
  toRaceCategory,
} from "@/lib/categories";

interface ResultRow {
  id: string;
  rank: number;
  time_display: string;
  event_name: string;
  event_slug: string;
  distance?: string;
  verified?: number;
  prize_amount_cents?: number;
  /** 1 when the race was a test run, shown with a tag. */
  is_test?: number;
  /** The event's prize split: "category" ranks women and men separately. */
  prize_split?: string | null;
  race_category?: string | null;
  category_rank?: number | null;
  /** 1 when they won their age group's award without a prize place. */
  age_group_award?: number;
  /** The event's age group award, e.g. "Product prize pack". */
  age_group_prize?: string | null;
}

/**
 * Race history as a list that reads across a line: place, race, time.
 * A win is picked out in gold on dark backgrounds and terracotta on light
 * ones, where gold would be too faint to read. In a race paid by category
 * the place is their place among the women or the men, with the overall
 * place alongside. A finisher there with no category has no place, so they
 * get a quiet dash and their overall place.
 */
export default function ResultsTable({
  rows,
  tone = "light",
  empty,
}: {
  rows: ResultRow[];
  /** "dark" when it sits on midnight. */
  tone?: "light" | "dark";
  /** What to say when there are no results yet. */
  empty?: ReactNode;
}) {
  const dark = tone === "dark";
  const rule = dark ? "rule-light" : "rule";

  if (rows.length === 0) {
    return (
      <div className={`border-t ${rule} pt-6`}>
        {empty ?? (
          <p className={`max-w-md leading-relaxed ${dark ? "text-bone/70" : "text-midnight/65"}`}>
            No results yet. Enter an event to get on the board.
          </p>
        )}
      </div>
    );
  }

  return (
    <ol className={`border-t ${rule}`}>
      {rows.map((r) => {
        const place = placeFor(r);
        const byCategory = toPrizeSplit(r.prize_split) === "category";
        const category = byCategory && place !== null ? toRaceCategory(r.race_category) : null;
        const rankTone =
          place === 1
            ? dark
              ? "text-gold"
              : "text-terracotta"
            : place !== null && place <= 3
              ? dark
                ? "text-bone"
                : "text-midnight"
              : dark
                ? "text-bone/40"
                : "text-midnight/40";
        const prize = r.prize_amount_cents && r.prize_amount_cents > 0 ? r.prize_amount_cents : 0;
        const award = r.age_group_award === 1;
        return (
          <li key={r.id} className={`border-b ${rule}`}>
            <Link
              href={`/events/${r.event_slug}`}
              className="group grid grid-cols-[2.5rem_1fr_auto] md:grid-cols-[3.75rem_1fr_auto] items-baseline gap-x-4 md:gap-x-6 py-5 md:py-6"
            >
              <span className={`t-numeral text-[1.7rem] md:text-[2.1rem] ${rankTone}`}>
                {place === null ? (
                  <>
                    <span className="sr-only">No category place</span>
                    <span aria-hidden>-</span>
                  </>
                ) : category ? (
                  <>
                    <span className="sr-only">{`${ordinal(place)} ${CATEGORY_NOUN[category]}`}</span>
                    <span aria-hidden>{place}</span>
                  </>
                ) : (
                  <>
                    <span className="sr-only">Position </span>
                    {place}
                  </>
                )}
              </span>
              <span className="min-w-0">
                <span
                  className={`block t-headline text-[1.25rem] md:text-[1.55rem] transition-colors duration-300 group-hover:text-terracotta ${
                    dark ? "text-bone" : "text-midnight"
                  }`}
                >
                  {r.event_name}
                </span>
                {(r.distance || r.verified === 1 || prize > 0 || award || byCategory || r.is_test === 1) && (
                  <span
                    className={`mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 t-eyebrow ${
                      dark ? "text-bone/50" : "text-dust"
                    }`}
                  >
                    {r.distance && <span>{r.distance}</span>}
                    {r.is_test === 1 && (
                      <span className={dark ? "text-bone/70" : "text-midnight/60"}>Test run</span>
                    )}
                    {category && (
                      <span className={dark ? "text-bone/70" : "text-midnight/60"}>
                        {CATEGORY_LABEL[category]}
                      </span>
                    )}
                    {byCategory && <span>{ordinal(r.rank)} overall</span>}
                    {r.verified === 1 && (
                      <span
                        className={`inline-flex items-center gap-1.5 ${dark ? "text-bone/60" : "text-trail"}`}
                        title="Verified"
                      >
                        <span
                          aria-hidden
                          className={`inline-block w-1.5 h-1.5 rounded-full ${dark ? "bg-bone/60" : "bg-trail"}`}
                        />
                        Verified
                      </span>
                    )}
                    {prize > 0 && (
                      <span className={dark ? "text-gold" : "text-midnight"}>
                        {formatFee(prize)} prize money
                      </span>
                    )}
                    {award && (
                      <span className={dark ? "text-gold" : "text-midnight"}>
                        {r.age_group_prize
                          ? `Age group prize, ${r.age_group_prize}`
                          : "Age group prize"}
                      </span>
                    )}
                  </span>
                )}
              </span>
              <span
                className={`t-numeral text-right text-[1.7rem] md:text-[2.1rem] ${dark ? "text-bone" : "text-midnight"}`}
              >
                {r.time_display}
              </span>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
