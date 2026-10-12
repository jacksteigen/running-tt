import Link from "next/link";
import { dateParts, formatEventDate } from "@/lib/dates";
import { formatFee } from "@/lib/money";

interface EventCardProps {
  slug: string;
  name: string;
  distance: string;
  date: string;
  location: string;
  venue: string;
  status: string;
  entryCount?: number;
  /** Leave out for past events; 0 shows "Free" on an upcoming event. */
  entryFeeCents?: number;
}

const statusStyles: Record<string, string> = {
  Open: "bg-trail text-white",
  "Sold Out": "bg-terracotta text-white",
  Completed: "bg-dust/40 text-midnight/70",
  "Coming Soon": "bg-stone text-midnight/70",
};

export default function EventCard({
  slug,
  name,
  distance,
  date,
  location,
  venue,
  status,
  entryCount = 0,
  entryFeeCents,
}: EventCardProps) {
  const { day, month, weekday, tbc } = dateParts(date);
  const statusCls = statusStyles[status] || "bg-stone text-midnight/70";
  const showFee = entryFeeCents !== undefined && status !== "Completed";

  return (
    <Link
      href={`/events/${slug}`}
      className="group block bg-white border border-stone/40 hover:border-midnight/30 transition-colors"
    >
      {/* Top band: distance + location like a race bib header */}
      <div className="flex items-center justify-between gap-3 bg-midnight text-white px-5 py-3">
        <p className="font-mono text-xs tracking-[0.2em] uppercase truncate">
          {distance} · {location}
        </p>
        <span
          className={`shrink-0 text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 ${statusCls}`}
        >
          {status}
        </span>
      </div>

      {/* Body */}
      <div className="px-5 py-5 flex gap-5 items-start">
        {/* Date block */}
        <div className="shrink-0 min-w-[3.5rem] text-center border-r border-stone/40 pr-5">
          <span className="sr-only">{formatEventDate(date, "long")}</span>
          <div aria-hidden>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-dust">
              {weekday}
            </p>
            <p
              className={`font-mono text-3xl font-semibold tracking-tight leading-none mt-1 ${
                tbc ? "text-midnight/45" : ""
              }`}
            >
              {day}
            </p>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-dust mt-1">
              {month || " "}
            </p>
          </div>
        </div>

        {/* Name + venue */}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold tracking-tight group-hover:text-terracotta transition-colors">
            {name}
          </h3>
          <p className="text-sm text-midnight/60 mt-1">{venue}</p>
          <div className="flex items-center gap-3 mt-3 text-xs text-midnight/60">
            {entryCount > 0 && (
              <span className="font-mono">
                <span className="text-midnight">{entryCount}</span> entered
              </span>
            )}
            {showFee && (
              <>
                {entryCount > 0 && (
                  <span className="text-stone/70">·</span>
                )}
                <span className="font-mono">
                  {entryFeeCents > 0
                    ? `${formatFee(entryFeeCents)} entry`
                    : "Free"}
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
