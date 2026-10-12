import Link from "next/link";
import type { HeatAvailability } from "@/lib/heats";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function spotsText(h: HeatAvailability) {
  if (h.closed) return "Started";
  if (h.full) return "Full";
  if (h.remaining === 1) return "Last spot";
  if (h.remaining <= 3) return `Last ${h.remaining}`;
  return `${h.remaining} left`;
}

/**
 * The heats for an event at a glance: when each one goes and how many spots
 * are left. Rows lead straight into booking with that heat picked when the
 * event is taking bookings. Server-safe, no hooks.
 */
export default function HeatSchedule({
  heats,
  timeWindow,
  bookHref = null,
  showSpots = true,
}: {
  heats: HeatAvailability[];
  /** "5:00pm to 7:45pm", or null while the first heat time is not set. */
  timeWindow: string | null;
  /** "/events/<slug>/book" while bookings are open, else null. */
  bookHref?: string | null;
  /** Off once the event is over, when spots left means nothing. */
  showSpots?: boolean;
}) {
  if (!heats.length) return null;

  const interval = heats.length > 1 ? heats[1].offsetMinutes - heats[0].offsetMinutes : null;
  const capacity = heats[0].capacity;
  // Heats that have already started no longer count towards spots left.
  const toRun = heats.filter((h) => !h.closed);
  const left = toRun.reduce((sum, h) => sum + h.remaining, 0);
  const spotsSummary =
    toRun.length === heats.length
      ? `${left} of ${heats.length * capacity} open`
      : toRun.length > 0
        ? `${left} open in later heats`
        : "All heats started";

  return (
    <div className="bg-white border border-stone/40">
      <div className="bg-midnight text-white px-4 sm:px-5 py-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-stone/70">
          {heats.length} heats{interval ? ` · ${interval} min apart` : ""}
        </p>
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-stone/50">
          {timeWindow ?? "Times TBC"}
        </p>
      </div>

      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-stone/30">
        {heats.map((h) => {
          const low = h.bookable && h.remaining <= 3;
          const row = (
            <>
              <span className="font-mono text-[11px] tracking-[0.15em] text-dust w-8 shrink-0">
                H{pad(h.number)}
              </span>
              <span
                className={`flex-1 min-w-0 truncate font-mono text-sm tabular-nums ${
                  !showSpots
                    ? "font-medium"
                    : h.closed
                      ? "text-midnight/40"
                      : h.full
                        ? "text-midnight/40 line-through decoration-midnight/30"
                        : "font-medium"
                }`}
              >
                {h.label}
              </span>
              {showSpots ? (
                <span
                  className={`shrink-0 font-mono text-[11px] uppercase tracking-[0.12em] tabular-nums px-1.5 py-0.5 ${
                    !h.bookable
                      ? "text-midnight/40"
                      : low
                        ? "bg-gold/25 text-midnight"
                        : "text-midnight/60"
                  }`}
                >
                  {spotsText(h)}
                </span>
              ) : (
                <span className="shrink-0 font-mono text-[11px] uppercase tracking-[0.12em] text-midnight/50 tabular-nums">
                  {h.booked} {h.booked === 1 ? "runner" : "runners"}
                </span>
              )}
            </>
          );

          return (
            <li key={h.number} className="bg-white">
              {bookHref && h.bookable ? (
                <Link
                  href={`${bookHref}?heat=${h.number}`}
                  aria-label={`Book heat ${h.number}, ${h.label}, ${spotsText(h).toLowerCase()}`}
                  className="group flex items-center gap-3 px-4 sm:px-5 min-h-12 hover:bg-bone transition-colors"
                >
                  {row}
                  <span
                    aria-hidden
                    className="shrink-0 text-midnight/30 group-hover:text-terracotta group-hover:translate-x-0.5 transition-all"
                  >
                    &rarr;
                  </span>
                </Link>
              ) : (
                <div className="flex items-center gap-3 px-4 sm:px-5 min-h-12">
                  {row}
                  {bookHref && (
                    <span aria-hidden className="shrink-0 invisible">
                      &rarr;
                    </span>
                  )}
                </div>
              )}
            </li>
          );
        })}
        {heats.length % 2 === 1 && <li aria-hidden className="hidden sm:block bg-white" />}
      </ul>

      <div className="px-4 sm:px-5 py-3 border-t border-stone/30 flex flex-wrap items-center justify-between gap-2 text-xs text-midnight/60">
        <p>
          {timeWindow
            ? "Pick the heat that suits you. Same course, same clock."
            : "Heat times are confirmed with the date."}
        </p>
        <p className="font-mono tabular-nums text-midnight/50">
          {capacity} per heat{showSpots ? ` · ${spotsSummary}` : ""}
        </p>
      </div>
    </div>
  );
}
