"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface EntryRow {
  id: string;
  userId: string;
  name: string;
  email: string;
  ageGroup: string | null;
  status: string;
  hasResult: boolean;
}

interface Candidate {
  id: string;
  name: string;
  email: string;
}

/** Who is in the event, with add and remove for walk-ups and fixes. */
export default function EntriesManager({
  eventId,
  entries,
  candidates,
}: {
  eventId: string;
  entries: EntryRow[];
  candidates: Candidate[];
}) {
  const router = useRouter();
  const [picked, setPicked] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function add() {
    if (!picked) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, userId: picked }),
      });
      const data = (await res.json()) as { success?: boolean; error?: string };
      if (data.success) {
        setPicked("");
        router.refresh();
      } else {
        setError(data.error || "Could not add");
      }
    } catch {
      setError("Could not connect");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string, name: string) {
    if (!window.confirm(`Remove ${name} from this event?`)) return;
    setError("");
    try {
      const res = await fetch(`/api/admin/entries/${id}`, { method: "DELETE" });
      const data = (await res.json()) as { success?: boolean; error?: string };
      if (data.success) router.refresh();
      else setError(data.error || "Could not remove");
    } catch {
      setError("Could not connect");
    }
  }

  return (
    <div className="bg-white border border-stone/40">
      <div className="px-5 py-4 border-b border-stone/30 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-dust mb-1">
            Start list
          </p>
          <h2 className="font-semibold tracking-tight">
            {entries.length} entered
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={picked}
            onChange={(e) => setPicked(e.target.value)}
            aria-label="Add an athlete"
            className="border border-stone/40 px-3 py-2 text-sm bg-bone/50 focus:outline-none focus:border-terracotta transition-colors max-w-[14rem]"
          >
            <option value="">Add an athlete...</option>
            {candidates.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.email})
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={add}
            disabled={!picked || busy}
            className="text-xs font-medium bg-midnight text-white px-4 py-2.5 hover:bg-midnight/90 transition-colors disabled:opacity-40"
          >
            Add
          </button>
        </div>
      </div>

      {error && (
        <p role="alert" className="px-5 pt-3 text-xs text-terracotta">
          {error}
        </p>
      )}

      {entries.length === 0 ? (
        <p className="px-5 py-8 text-sm text-midnight/50 text-center">
          No entries yet.
        </p>
      ) : (
        <div className="divide-y divide-stone/30">
          {entries.map((e) => (
            <div key={e.id} className="px-5 py-3 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <Link
                  href={`/admin/athletes/${e.userId}`}
                  className="text-sm font-medium hover:text-terracotta transition-colors"
                >
                  {e.name}
                </Link>
                <p className="text-[11px] text-midnight/50 truncate">
                  {e.email} · {e.ageGroup ?? "no age group yet"}
                </p>
              </div>
              <span
                className={`text-[10px] font-medium uppercase tracking-wider px-2 py-1 ${
                  e.status === "confirmed" ? "bg-trail/10 text-trail" : "bg-gold/20 text-midnight"
                }`}
              >
                {e.status === "confirmed" ? "Entered" : "Pending"}
              </span>
              <button
                type="button"
                onClick={() => remove(e.id, e.name)}
                disabled={e.hasResult}
                title={e.hasResult ? "Clear their time first" : "Remove from event"}
                className="text-xs text-dust hover:text-terracotta transition-colors disabled:opacity-30 disabled:hover:text-dust"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
