import Link from "next/link";
import type { ReactNode } from "react";
import { formatFee } from "@/lib/money";

interface ResultRow {
  id: string;
  rank: number;
  time_display: string;
  event_name: string;
  event_slug: string;
  distance?: string;
  verified?: number;
  prize_amount_cents?: number;
}

/**
 * Race history as a list that reads across a line: place, race, time.
 * A win is picked out in gold on dark backgrounds and terracotta on light
 * ones, where gold would be too faint to read.
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
        const rankTone =
          r.rank === 1
            ? dark
              ? "text-gold"
              : "text-terracotta"
            : r.rank <= 3
              ? dark
                ? "text-bone"
                : "text-midnight"
              : dark
                ? "text-bone/40"
                : "text-midnight/40";
        const prize = r.prize_amount_cents && r.prize_amount_cents > 0 ? r.prize_amount_cents : 0;
        return (
          <li key={r.id} className={`border-b ${rule}`}>
            <Link
              href={`/events/${r.event_slug}`}
              className="group grid grid-cols-[2.5rem_1fr_auto] md:grid-cols-[3.75rem_1fr_auto] items-baseline gap-x-4 md:gap-x-6 py-5 md:py-6"
            >
              <span className={`t-numeral text-[1.7rem] md:text-[2.1rem] ${rankTone}`}>
                <span className="sr-only">Position </span>
                {r.rank}
              </span>
              <span className="min-w-0">
                <span
                  className={`block t-headline text-[1.25rem] md:text-[1.55rem] transition-colors duration-300 group-hover:text-terracotta ${
                    dark ? "text-bone" : "text-midnight"
                  }`}
                >
                  {r.event_name}
                </span>
                {(r.distance || r.verified === 1 || prize > 0) && (
                  <span
                    className={`mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 t-eyebrow ${
                      dark ? "text-bone/50" : "text-dust"
                    }`}
                  >
                    {r.distance && <span>{r.distance}</span>}
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
