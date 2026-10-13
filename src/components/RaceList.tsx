import Link from "next/link";
import { dateParts, formatEventDate } from "@/lib/dates";
import { formatFee } from "@/lib/money";

export interface RaceListItem {
  slug: string;
  name: string;
  distance: string;
  date: string;
  venue: string;
  location: string;
  status: string;
  entryFeeCents: number;
  /** Cash prize purse in cents, from purseCents(). Shown only above zero. */
  prizeCents?: number;
  entered?: number;
}

const statusTone: Record<string, string> = {
  Open: "text-trail",
  "Sold Out": "text-terracotta",
  "Coming Soon": "text-dust",
  Completed: "text-midnight/45",
};

/**
 * Races as an editorial list rather than a grid of boxes: date, name and
 * place read across one line, like a fixture list in a race programme.
 */
export default function RaceList({ races }: { races: RaceListItem[] }) {
  return (
    <ol className="border-t rule">
      {races.map((r) => {
        const d = dateParts(r.date);
        const purse = r.prizeCents ?? 0;
        return (
          <li key={r.slug} className="border-b rule">
            <Link
              href={`/events/${r.slug}`}
              className="group grid grid-cols-[4.25rem_1fr] md:grid-cols-[6rem_1fr_auto] items-center gap-x-5 md:gap-x-10 py-6 md:py-8"
            >
              <div className="text-midnight">
                <p className="t-eyebrow text-dust">{d.weekday}</p>
                <p className="t-numeral text-[2.6rem] md:text-[3.4rem] mt-1">{d.day}</p>
                <p className="t-eyebrow text-dust mt-1">{d.month || " "}</p>
              </div>
              <div className="min-w-0">
                <p className="t-eyebrow text-terracotta">
                  {r.distance}
                  <span className={`ml-3 ${statusTone[r.status] ?? "text-dust"}`}>{r.status}</span>
                </p>
                <h3 className="t-headline text-[1.7rem] md:text-[2.4rem] mt-2 group-hover:text-terracotta transition-colors duration-300">
                  {r.name}
                </h3>
                <p className="mt-2 text-[0.95rem] text-midnight/60">
                  {[r.venue, r.location].filter((v) => v && !/TBC/i.test(v)).join(", ") ||
                    "Venue to be announced"}
                  {d.tbc ? "" : ` · ${formatEventDate(r.date, "medium")}`}
                  {purse > 0 && (
                    <>
                      {" · "}
                      <span className="whitespace-nowrap text-midnight">
                        {formatFee(purse)} prize purse
                      </span>
                    </>
                  )}
                </p>
              </div>
              <div className="col-start-2 md:col-start-3 mt-4 md:mt-0 flex md:flex-col md:items-end gap-4 md:gap-1.5 text-sm text-midnight/60">
                <span className="t-numeral text-xl md:text-2xl text-midnight">
                  {r.entryFeeCents > 0 ? formatFee(r.entryFeeCents) : "Free"}
                </span>
                {!!r.entered && r.entered > 0 && <span>{r.entered} in</span>}
                <span className="link-draw text-midnight group-hover:text-terracotta transition-colors">
                  View race
                </span>
              </div>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
