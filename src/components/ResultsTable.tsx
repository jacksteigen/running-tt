import Link from "next/link";

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

export default function ResultsTable({ rows }: { rows: ResultRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="bg-white border border-stone/40 p-12 text-center">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-dust mb-2">
          No results yet
        </p>
        <p className="text-sm text-midnight/60">
          Enter an event to get on the board.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-stone/40 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-midnight text-stone/60 text-left text-[10px] uppercase tracking-[0.2em] font-mono">
            <th className="px-4 py-3 w-14">Pos</th>
            <th className="px-4 py-3">Event</th>
            <th className="px-4 py-3 text-right">Time</th>
            <th className="px-4 py-3 text-right hidden sm:table-cell w-24">
              Prize
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const podium =
              r.rank === 1
                ? "border-l-2 border-gold"
                : r.rank === 2
                  ? "border-l-2 border-stone"
                  : r.rank === 3
                    ? "border-l-2 border-dust"
                    : "border-l-2 border-transparent";
            const rankColor =
              r.rank === 1
                ? "text-gold"
                : r.rank <= 3
                  ? "text-midnight"
                  : "text-midnight/40";
            return (
              <tr
                key={r.id}
                className={`border-b border-stone/20 last:border-b-0 hover:bg-bone/60 transition-colors ${podium}`}
              >
                <td
                  className={`px-4 py-3 font-mono font-semibold tabular-nums ${rankColor}`}
                >
                  {String(r.rank).padStart(2, "0")}
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/events/${r.event_slug}`}
                    className="font-medium hover:text-terracotta transition-colors"
                  >
                    {r.event_name}
                  </Link>
                  {r.distance && (
                    <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.2em] text-dust">
                      {r.distance}
                    </span>
                  )}
                  {r.verified === 1 && (
                    <span
                      className="ml-2 text-[10px] text-trail inline-flex items-center gap-1"
                      title="Verified"
                    >
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-trail" />
                      verified
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 font-mono tabular-nums text-right font-semibold">
                  {r.time_display}
                </td>
                <td className="px-4 py-3 text-right hidden sm:table-cell font-mono tabular-nums">
                  {r.prize_amount_cents && r.prize_amount_cents > 0 ? (
                    <span className="text-gold">
                      ${r.prize_amount_cents / 100}
                    </span>
                  ) : (
                    <span className="text-stone/60">-</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
