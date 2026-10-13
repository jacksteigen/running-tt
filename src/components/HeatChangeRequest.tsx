"use client";

import { useState } from "react";
import { fieldLabelCls, fieldTextareaCls } from "@/components/fieldStyles";

interface HeatOption {
  number: number;
  label: string;
  full: boolean;
}

const NOTE_MAX = 500;

const inputCls = fieldTextareaCls;
const labelCls = fieldLabelCls;
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
    <div className="border-t rule pt-10 md:pt-12">
      <h2 className="t-headline text-[1.9rem] md:text-[2.3rem]">
        Need a different <em>heat?</em>
      </h2>
      <p className="mt-3 text-[1rem] text-midnight/65 leading-relaxed max-w-xl">
        Changes are made by the Running TT team{changeFeeText}.
      </p>

      <div aria-live="polite">
        {state === "sent" && (
          <div className="mt-7 border-l-2 border-trail pl-5 py-1 motion-safe:animate-page-in">
            <p className="text-[0.98rem] font-medium text-trail">Request sent.</p>
            <p className="text-[0.98rem] text-midnight/70 mt-0.5">
              We will be in touch to confirm the move and the admin fee.
            </p>
          </div>
        )}
        {state === "pending" && (
          <div className="mt-7 flex items-center gap-3">
            <span aria-hidden className="h-2 w-2 rounded-full bg-gold shrink-0" />
            <p className="text-[0.98rem] text-midnight/80">
              <span className="font-medium">Change requested.</span> We will be in touch.
            </p>
          </div>
        )}
      </div>

      {state === "idle" && !open && (
        <button type="button" onClick={() => setOpen(true)} className="btn btn-ghost mt-7 w-full sm:w-auto">
          Request a heat change
        </button>
      )}

      {state === "idle" && open && (
        <form
          onSubmit={submit}
          className="mt-8 bg-white border border-midnight/12 p-6 md:p-8 space-y-6 motion-safe:animate-page-in"
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
            <p className="mt-2 t-caption text-midnight/55">
              Full heats can still be requested. We will tell you if a spot opens.
            </p>
          </div>

          <div>
            <label htmlFor="change-note" className={labelCls}>
              Note{" "}
              <span className="font-normal normal-case tracking-normal text-midnight/45">(optional)</span>
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
            <p id="change-note-count" className="mt-1.5 text-right t-numeral text-[0.8rem] text-midnight/40">
              {note.length}/{NOTE_MAX}
            </p>
          </div>

          {error && (
            <p role="alert" className="text-[0.92rem] text-terracotta">
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
              className="btn btn-ghost"
            >
              Cancel
            </button>
            <button type="submit" disabled={busy} className="btn btn-primary flex-1 sm:flex-none">
              {busy ? "Sending..." : "Send request"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
