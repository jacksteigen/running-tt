"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { PrizeSlot } from "@/lib/racetime";

interface Entrant {
  userId: string;
  name: string;
  email: string;
  ageGroup: string | null;
  time: string;
  heat: number;
}

interface Standing {
  userId: string;
  rank: number;
  ageGroup: string | null;
  ageGroupRank: number | null;
  timeDisplay: string;
  heat: number;
  prizeCents: number;
}

type RowState = { time: string; heat: string; status: "idle" | "saving" | "saved" | "error"; message?: string };

/**
 * Finish-line results, one athlete at a time as heats come through. Every
 * save re-ranks the whole event, so the public leaderboard is live.
 */
export default function ResultsEditor({
  eventId,
  eventSlug,
  entrants,
  initialStandings,
  prizes,
}: {
  eventId: string;
  eventSlug: string;
  entrants: Entrant[];
  initialStandings: Standing[];
  prizes: PrizeSlot[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState<Record<string, RowState>>(
    Object.fromEntries(
      entrants.map((e) => [
        e.userId,
        { time: e.time, heat: String(e.heat || 1), status: "idle" as const },
      ])
    )
  );
  const [standings, setStandings] = useState<Standing[]>(initialStandings);
  const [filter, setFilter] = useState("");

  const standingByUser = useMemo(
    () => new Map(standings.map((s) => [s.userId, s])),
    [standings]
  );

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const list = q
      ? entrants.filter(
          (e) =>
            e.name.toLowerCase().includes(q) ||
            e.email.toLowerCase().includes(q)
        )
      : entrants;
    // Athletes with a time float to the top in finishing order.
    return [...list].sort((a, b) => {
      const ra = standingByUser.get(a.userId)?.rank ?? 9999;
      const rb = standingByUser.get(b.userId)?.rank ?? 9999;
      if (ra !== rb) return ra - rb;
      return a.name.localeCompare(b.name);
    });
  }, [entrants, filter, standingByUser]);

  function update(userId: string, patch: Partial<RowState>) {
    setRows((prev) => ({ ...prev, [userId]: { ...prev[userId], ...patch } }));
  }

  async function save(userId: string) {
    const row = rows[userId];
    if (!row.time.trim()) return;
    update(userId, { status: "saving", message: undefined });
    try {
      const res = await fetch("/api/admin/results", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, userId, time: row.time, heat: row.heat }),
      });
      const data = (await res.json()) as {
        success?: boolean;
        standings?: Standing[];
        error?: string;
      };
      if (data.success && data.standings) {
        setStandings(data.standings);
        const mine = data.standings.find((s) => s.userId === userId);
        update(userId, { status: "saved", time: mine?.timeDisplay ?? row.time });
        router.refresh();
        setTimeout(() => update(userId, { status: "idle" }), 1800);
      } else {
        update(userId, { status: "error", message: data.error || "Could not save" });
      }
    } catch {
      update(userId, { status: "error", message: "Could not connect" });
    }
  }

  async function clear(userId: string) {
    update(userId, { status: "saving" });
    try {
      const res = await fetch("/api/admin/results", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, userId }),
      });
      const data = (await res.json()) as { success?: boolean; standings?: Standing[] };
      if (data.success && data.standings) {
        setStandings(data.standings);
        update(userId, { status: "idle", time: "" });
        router.refresh();
      } else {
        update(userId, { status: "error", message: "Could not clear" });
      }
    } catch {
      update(userId, { status: "error", message: "Could not connect" });
    }
  }

  if (entrants.length === 0) {
    return (
      <div className="bg-white border border-stone/40 p-10 text-center">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-dust mb-2">
          Nobody entered yet
        </p>
        <p className="text-sm text-midnight/60 max-w-sm mx-auto">
          Athletes appear here the moment they enter. Add them above, or put
          the QR code on a screen and let them sign themselves up.
        </p>
      </div>
    );
  }

  const done = standings.length;

  return (
    <div className="bg-white border border-stone/40">
      <div className="px-5 py-4 border-b border-stone/30 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-dust mb-1">
            Live results
          </p>
          <h2 className="font-semibold tracking-tight">
            {done} of {entrants.length} timed
          </h2>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Find an athlete"
            aria-label="Find an athlete"
            className="border border-stone/40 px-3 py-2 text-sm bg-bone/50 focus:outline-none focus:border-terracotta transition-colors w-44"
          />
          <Link
            href={`/events/${eventSlug}`}
            target="_blank"
            className="text-xs font-medium text-terracotta border border-terracotta/30 px-3 py-2 hover:bg-terracotta/5 transition-colors whitespace-nowrap"
          >
            Public board
          </Link>
        </div>
      </div>

      <div className="divide-y divide-stone/30">
        {visible.map((entrant) => {
          const row = rows[entrant.userId];
          const standing = standingByUser.get(entrant.userId);
          return (
            <div
              key={entrant.userId}
              className="px-5 py-3 flex flex-wrap sm:flex-nowrap items-center gap-3"
            >
              <span
                className={`font-mono text-sm w-8 shrink-0 tabular-nums ${
                  standing?.rank === 1
                    ? "text-gold font-semibold"
                    : standing
                      ? "text-midnight"
                      : "text-stone"
                }`}
              >
                {standing ? String(standing.rank).padStart(2, "0") : "--"}
              </span>
              <div className="flex-1 min-w-[10rem]">
                <p className="text-sm font-medium truncate">{entrant.name}</p>
                <p className="text-[11px] text-midnight/50 truncate">
                  {entrant.ageGroup ?? "No age group"}
                  {standing?.ageGroupRank
                    ? ` · ${ordinal(standing.ageGroupRank)} in group`
                    : ""}
                  {standing && standing.prizeCents > 0
                    ? ` · $${(standing.prizeCents / 100).toFixed(0)}`
                    : ""}
                </p>
              </div>
              <label className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-dust">
                Heat
                <input
                  type="number"
                  min={1}
                  value={row.heat}
                  onChange={(e) => update(entrant.userId, { heat: e.target.value })}
                  className="w-14 border border-stone/40 px-2 py-2 text-sm font-mono bg-bone/50 focus:outline-none focus:border-terracotta transition-colors"
                  aria-label={`Heat for ${entrant.name}`}
                />
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={row.time}
                onChange={(e) => update(entrant.userId, { time: e.target.value, status: "idle" })}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    save(entrant.userId);
                  }
                }}
                placeholder="4:32.10"
                aria-label={`Finish time for ${entrant.name}`}
                className="w-28 border border-stone/40 px-3 py-2 text-sm font-mono bg-bone/50 focus:outline-none focus:border-terracotta transition-colors"
              />
              <button
                type="button"
                onClick={() => save(entrant.userId)}
                disabled={row.status === "saving" || !row.time.trim()}
                className="text-xs font-medium bg-midnight text-white px-4 py-2 hover:bg-midnight/90 transition-colors disabled:opacity-40 min-w-[4.5rem]"
              >
                {row.status === "saving"
                  ? "..."
                  : row.status === "saved"
                    ? "Saved"
                    : standing
                      ? "Update"
                      : "Save"}
              </button>
              {standing && (
                <button
                  type="button"
                  onClick={() => clear(entrant.userId)}
                  aria-label={`Clear time for ${entrant.name}`}
                  className="text-xs text-dust hover:text-terracotta transition-colors px-1"
                >
                  Clear
                </button>
              )}
              {row.status === "error" && (
                <p role="alert" className="w-full sm:w-auto text-xs text-terracotta">
                  {row.message}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <div className="px-5 py-4 border-t border-stone/30 text-xs text-midnight/50 leading-relaxed">
        Type a time and press Enter. Every save re-ranks the whole event
        {prizes.length > 0
          ? " and assigns prize money down the finishing order."
          : "."}{" "}
        The public leaderboard refreshes itself.
      </div>
    </div>
  );
}

function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
