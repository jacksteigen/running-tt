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
 * The heats for an event at a glance, set like a start list: when each one
 * goes and how many spots are left, on hairlines rather than in a box. Rows
 * lead straight into booking with that heat picked when the event is taking
 * bookings. Server-safe, no hooks.
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
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 pb-4">
        <p className="t-eyebrow text-dust">
          {heats.length} heats{interval ? ` · ${interval} min apart` : ""}
        </p>
        <p className="t-eyebrow text-dust">{timeWindow ?? "Times TBC"}</p>
      </div>

      <ul className="grid grid-cols-1 sm:grid-cols-2 sm:gap-x-10 border-t rule">
        {heats.map((h) => {
          const low = h.bookable && h.remaining <= 3;
          const row = (
            <>
              <span className="t-eyebrow text-dust w-9 shrink-0">H{pad(h.number)}</span>
              <span
                className={`flex-1 min-w-0 truncate t-numeral text-[1.3rem] md:text-[1.45rem] ${
                  !showSpots
                    ? ""
                    : h.closed
                      ? "text-midnight/40"
                      : h.full
                        ? "text-midnight/40 line-through decoration-midnight/30 decoration-1"
                        : ""
                }`}
              >
                {h.label}
              </span>
              {showSpots ? (
                <span
                  className={`shrink-0 t-eyebrow ${
                    !h.bookable ? "text-midnight/40" : low ? "text-terracotta" : "text-midnight/60"
                  }`}
                >
                  {spotsText(h)}
                </span>
              ) : (
                <span className="shrink-0 t-eyebrow text-midnight/50">
                  {h.booked} {h.booked === 1 ? "runner" : "runners"}
                </span>
              )}
            </>
          );

          return (
            <li key={h.number} className="border-b rule">
              {bookHref && h.bookable ? (
                <Link
                  href={`${bookHref}?heat=${h.number}`}
                  aria-label={`Book heat ${h.number}, ${h.label}, ${spotsText(h).toLowerCase()}`}
                  className="group flex items-center gap-4 min-h-14 py-2 hover:text-terracotta transition-colors duration-300"
                >
                  {row}
                  <span
                    aria-hidden
                    className="shrink-0 t-eyebrow text-midnight/35 group-hover:text-terracotta transition-colors duration-300"
                  >
                    Book
                  </span>
                </Link>
              ) : (
                <div className="flex items-center gap-4 min-h-14 py-2">
                  {row}
                  {bookHref && (
                    <span aria-hidden className="shrink-0 t-eyebrow invisible">
                      Book
                    </span>
                  )}
                </div>
              )}
            </li>
          );
        })}
        {heats.length % 2 === 1 && <li aria-hidden className="hidden sm:block border-b rule" />}
      </ul>

      <div className="mt-4 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <p className="t-caption text-midnight/60">
          {timeWindow
            ? "Pick the heat that suits you. Same course, same clock."
            : "Heat times are confirmed with the date."}
        </p>
        <p className="t-eyebrow text-midnight/50">
          {capacity} per heat{showSpots ? ` · ${spotsSummary}` : ""}
        </p>
      </div>
    </div>
  );
}
