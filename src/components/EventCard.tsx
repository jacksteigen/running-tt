import Link from "next/link";

interface EventCardProps {
  slug: string;
  name: string;
  distance: string;
  date: string;
  location: string;
  venue: string;
  status: string;
  entryCount?: number;
  entryFeeCents?: number;
}

function formatDayMonth(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  const day = d.toLocaleDateString("en-AU", { day: "2-digit" });
  const month = d.toLocaleDateString("en-AU", { month: "short" }).toUpperCase();
  const weekday = d
    .toLocaleDateString("en-AU", { weekday: "short" })
    .toUpperCase();
  return { day, month, weekday };
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
  entryFeeCents = 0,
}: EventCardProps) {
  const { day, month, weekday } = formatDayMonth(date);
  const statusCls = statusStyles[status] || "bg-stone text-midnight/70";

  return (
    <Link
      href={`/events/${slug}`}
      className="group block bg-white border border-stone/40 hover:border-midnight/30 transition-colors"
    >
      {/* Top band: distance + location like a race bib header */}
      <div className="flex items-center justify-between bg-midnight text-white px-5 py-3">
        <p className="font-mono text-xs tracking-[0.2em] uppercase">
          {distance} · {location}
        </p>
        <span
          className={`text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 ${statusCls}`}
        >
          {status}
        </span>
      </div>

      {/* Body */}
      <div className="px-5 py-5 flex gap-5 items-start">
        {/* Date block */}
        <div className="shrink-0 text-center border-r border-stone/40 pr-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-dust">
            {weekday}
          </p>
          <p className="font-mono text-3xl font-semibold tracking-tight leading-none mt-1">
            {day}
          </p>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-dust mt-1">
            {month}
          </p>
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
            {entryFeeCents > 0 && (
              <>
                {entryCount > 0 && (
                  <span className="text-stone/70">·</span>
                )}
                <span className="font-mono">
                  ${(entryFeeCents / 100).toFixed(0)} entry
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
