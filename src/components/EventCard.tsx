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

const statusTone: Record<string, string> = {
  Open: "text-trail",
  "Sold Out": "text-terracotta",
  "Coming Soon": "text-dust",
  Completed: "text-midnight/45",
};

/**
 * One race as a single quiet line: the compact sibling of RaceList, used for
 * the archive of past races. Render it inside an <li> on a hairline list.
 */
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
  const year = tbc ? "" : date.slice(0, 4);
  const showFee = entryFeeCents !== undefined && status !== "Completed";
  const place =
    [venue, location].filter((v) => v && !/TBC/i.test(v)).join(", ") || "Venue to be announced";

  return (
    <Link
      href={`/events/${slug}`}
      className="group grid grid-cols-[4.25rem_1fr] md:grid-cols-[6rem_1fr_auto] items-center gap-x-5 md:gap-x-10 py-5 md:py-6"
    >
      <span className="sr-only">{formatEventDate(date, "long")}</span>
      <div aria-hidden className="text-midnight/75">
        <p className="t-eyebrow text-dust">{weekday}</p>
        <p className={`t-numeral text-[2rem] md:text-[2.5rem] mt-1 ${tbc ? "text-midnight/45" : ""}`}>
          {day}
        </p>
        <p className="t-eyebrow text-dust mt-1">{[month, year].filter(Boolean).join(" ") || " "}</p>
      </div>

      <div className="min-w-0">
        <p className="t-eyebrow text-dust">
          {distance}
          <span className={`ml-3 ${statusTone[status] ?? "text-dust"}`}>{status}</span>
        </p>
        <h3 className="t-headline text-[1.4rem] md:text-[1.8rem] mt-1.5 group-hover:text-terracotta transition-colors duration-300">
          {name}
        </h3>
        <p className="mt-1.5 text-[0.92rem] text-midnight/60">{place}</p>
      </div>

      <div className="col-start-2 md:col-start-3 mt-3 md:mt-0 flex flex-wrap md:flex-col md:items-end gap-x-4 gap-y-1 md:gap-1.5 text-sm text-midnight/60">
        {showFee && (
          <span className="t-numeral text-lg md:text-xl text-midnight">
            {entryFeeCents > 0 ? `${formatFee(entryFeeCents)} entry` : "Free"}
          </span>
        )}
        {entryCount > 0 && <span>{entryCount} entered</span>}
        <span className="link-draw text-midnight group-hover:text-terracotta transition-colors">
          {status === "Completed" ? "Results" : "View race"}
        </span>
      </div>
    </Link>
  );
}
