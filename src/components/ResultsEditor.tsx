"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PrizeSlot } from "@/lib/racetime";

interface Entrant {
  userId: string;
  name: string;
  email: string;
  time: string;
  rank: number | null;
  prizeCents: number;
}

/**
 * Finish-line results entry. Type each athlete's time in any usual shorthand
 * ("4:32.10", "72.5"); ranking and prize money are worked out on save.
 */
export default function ResultsEditor({
  eventId,
  entrants,
  prizes,
}: {
  eventId: string;
  entrants: Entrant[];
  prizes: PrizeSlot[];
}) {
  const router = useRouter();
  const [times, setTimes] = useState<Record<string, string>>(
    Object.fromEntries(entrants.map((e) => [e.userId, e.time]))
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSave() {
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const res = await fetch("/api/admin/results", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId,
          rows: Object.entries(times).map(([userId, time]) => ({
            userId,
            time,
          })),
        }),
      });

      const data = (await res.json()) as {
        success?: boolean;
        saved?: number;
        error?: string;
      };

      if (data.success) {
        setMessage(
          `Saved ${data.saved} result${data.saved === 1 ? "" : "s"}. Rankings and prize money updated.`
        );
        router.refresh();
      } else {
        setError(data.error || "Could not save results");
      }
    } catch {
      setError("Could not connect. Try again.");
    } finally {
      setSaving(false);
    }
  }

  if (entrants.length === 0) {
    return (
      <div className="bg-white border border-stone/40 p-10 text-center">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-dust mb-2">
          Nobody entered yet
        </p>
        <p className="text-sm text-midnight/60 max-w-sm mx-auto">
          Athletes appear here the moment they enter. Put the QR code on a
          screen and let them sign themselves up.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="bg-white border border-stone/40">
        <div className="px-5 py-4 border-b border-stone/30 flex items-end justify-between">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-dust mb-1">
              Start list
            </p>
            <h2 className="font-semibold tracking-tight">
              {entrants.length} athlete{entrants.length === 1 ? "" : "s"}
            </h2>
          </div>
          <p className="text-xs text-midnight/50">
            Leave a time blank to skip that athlete
          </p>
        </div>

        <div className="divide-y divide-stone/30">
          {entrants.map((entrant, i) => (
            <div
              key={entrant.userId}
              className="px-5 py-3 flex items-center gap-4"
            >
              <span className="font-mono text-xs text-dust w-6 shrink-0">
                {entrant.rank ?? i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{entrant.name}</p>
                <p className="text-xs text-midnight/50 truncate">
                  {entrant.email}
                </p>
              </div>
              {entrant.prizeCents > 0 && (
                <span className="font-mono text-xs text-gold shrink-0">
                  ${(entrant.prizeCents / 100).toFixed(0)}
                </span>
              )}
              <input
                type="text"
                inputMode="decimal"
                value={times[entrant.userId] ?? ""}
                onChange={(e) =>
                  setTimes((prev) => ({
                    ...prev,
                    [entrant.userId]: e.target.value,
                  }))
                }
                placeholder="4:32.10"
                aria-label={`Finish time for ${entrant.name}`}
                className="w-28 shrink-0 border border-stone/40 px-3 py-2 text-sm font-mono bg-bone/50 focus:outline-none focus:border-terracotta transition-colors"
              />
            </div>
          ))}
        </div>
      </div>

      <div aria-live="polite" className="mt-4">
        {message && <p className="text-sm text-trail">{message}</p>}
        {error && (
          <p role="alert" className="text-sm text-terracotta">
            {error}
          </p>
        )}
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="mt-4 w-full sm:w-auto bg-terracotta text-white text-sm font-medium px-8 py-3 hover:bg-terracotta/90 transition-colors disabled:opacity-50"
      >
        {saving ? "Saving..." : "Save results"}
      </button>

      <p className="mt-4 text-xs text-midnight/50 leading-relaxed max-w-lg">
        Times are ranked fastest first.
        {prizes.length > 0
          ? " Prize money is assigned down the finishing order from the prize list above."
          : " No prize list is set for this event, so no prize money is recorded."}{" "}
        Saving again updates what is already there, so you can fix a time at
        any point.
      </p>
    </div>
  );
}
