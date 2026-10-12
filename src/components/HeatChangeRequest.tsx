"use client";

import { useState } from "react";

interface HeatOption {
  number: number;
  label: string;
  full: boolean;
}

const NOTE_MAX = 500;

const inputCls =
  "w-full border border-stone/50 bg-bone/50 px-4 py-3.5 text-base focus:outline-none focus:border-terracotta transition-colors";
const labelCls = "block font-mono text-[10px] uppercase tracking-[0.25em] text-dust mb-2";
const SELECT_CHEVRON: React.CSSProperties = {
  backgroundImage:
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 8' fill='none' stroke='%237A644A' stroke-width='1.5'%3E%3Cpath d='M1 1.5 6 6.5 11 1.5'/%3E%3C/svg%3E\")",
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 1rem center",
  backgroundSize: "12px 8px",
};

/**
 * Athletes never move themselves. This sends the team a request, and the
 * team makes the move (and charges the admin fee) by hand.
 */
export default function HeatChangeRequest({
  entryId,
  currentHeat,
  heats,
  changeFeeText,
  hasOpenRequest,
}: {
  entryId: string;
  currentHeat: number | null;
  heats: HeatOption[];
  /** From changeFeeText(): " and carry a $5 admin fee". */
  changeFeeText: string;
  hasOpenRequest: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [requestedHeat, setRequestedHeat] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [state, setState] = useState<"idle" | "sent" | "pending">(hasOpenRequest ? "pending" : "idle");

  const others = heats.filter((h) => h.number !== currentHeat);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/heat-change-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entryId,
          requestedHeat: requestedHeat ? Number(requestedHeat) : null,
          note: note.trim(),
        }),
      });
      if (res.status === 409) {
        setState("pending");
        return;
      }
      const data = (await res.json()) as { success?: boolean; error?: string };
      if (data.success) {
        setState("sent");
        return;
      }
      setError(data.error || "Something went wrong. Try again.");
    } catch {
      setError("Could not connect. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-white border border-stone/40">
      <div className="p-6 md:p-7">
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-dust mb-2">Manage booking</p>
        <h2 className="text-xl font-semibold tracking-tight">Need a different heat?</h2>
        <p className="mt-2 text-sm text-midnight/60 leading-relaxed max-w-xl">
          Changes are made by the Running TT team{changeFeeText}.
        </p>

        <div aria-live="polite">
          {state === "sent" && (
            <div className="mt-6 border-l-2 border-trail bg-trail/5 px-4 py-3.5 motion-safe:animate-page-in">
              <p className="text-sm font-medium text-trail">Request sent.</p>
              <p className="text-sm text-midnight/70 mt-0.5">
                We will be in touch to confirm the move and the admin fee.
              </p>
            </div>
          )}
          {state === "pending" && (
            <div className="mt-6 flex items-center gap-3 border border-stone/50 bg-bone/60 px-4 py-3.5">
              <span aria-hidden className="h-2 w-2 rounded-full bg-gold shrink-0" />
              <p className="text-sm text-midnight/80">
                <span className="font-medium">Change requested.</span> We will be in touch.
              </p>
            </div>
          )}
        </div>

        {state === "idle" && !open && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="mt-6 w-full sm:w-auto border border-midnight/20 text-sm font-medium px-6 py-3.5 min-h-12 hover:border-midnight/50 transition-colors"
          >
            Request a heat change
          </button>
        )}
      </div>

      {state === "idle" && open && (
        <form
          onSubmit={submit}
          className="border-t border-stone/30 p-6 md:p-7 space-y-5 motion-safe:animate-page-in"
        >
          <div>
            <label htmlFor="requested-heat" className={labelCls}>
              Preferred heat
            </label>
            <select
              id="requested-heat"
              value={requestedHeat}
              onChange={(e) => setRequestedHeat(e.target.value)}
              autoFocus
              className={`${inputCls} appearance-none pr-10`}
              style={SELECT_CHEVRON}
            >
              <option value="">Any other heat</option>
              {others.map((h) => (
                <option key={h.number} value={h.number}>
                  Heat {h.number} · {h.label}
                  {h.full ? " (full)" : ""}
                </option>
              ))}
            </select>
            <p className="mt-2 text-xs text-midnight/50">
              Full heats can still be requested. We will tell you if a spot opens.
            </p>
          </div>

          <div>
            <label htmlFor="change-note" className={labelCls}>
              Note <span className="text-midnight/40 normal-case tracking-normal">(optional)</span>
            </label>
            <textarea
              id="change-note"
              rows={3}
              maxLength={NOTE_MAX}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Anything we should know, like a time you cannot make."
              className={`${inputCls} resize-y`}
              aria-describedby="change-note-count"
            />
            <p id="change-note-count" className="mt-1.5 text-right font-mono text-[10px] text-midnight/40 tabular-nums">
              {note.length}/{NOTE_MAX}
            </p>
          </div>

          {error && (
            <p role="alert" className="text-sm text-terracotta">
              {error}
            </p>
          )}

          <div className="flex flex-col-reverse sm:flex-row gap-3">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setError("");
              }}
              className="border border-midnight/20 text-sm font-medium px-6 py-3.5 min-h-12 hover:border-midnight/50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="flex-1 sm:flex-none bg-terracotta text-white text-sm font-medium px-6 py-3.5 min-h-12 hover:bg-terracotta/90 transition-colors disabled:opacity-60"
            >
              {busy ? "Sending..." : "Send request"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
