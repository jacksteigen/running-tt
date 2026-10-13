"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  HeatSelect,
  firstOpenHeat,
  heatName,
  sendWithHeatCheck,
  type HeatOption,
} from "@/components/WalkUpForm";
import { formatFee } from "@/lib/money";

export interface ChangeRequest {
  id: string;
  entryId: string;
  userId: string;
  name: string;
  email: string;
  /** Their heat right now (not when they asked). */
  currentHeat: number | null;
  /** null means any other heat will do. */
  requestedHeat: number | null;
  note: string | null;
  /** "2 hrs ago" */
  madeAgo: string;
  /** "Tue 13 Oct, 4:05 pm" in Melbourne time. */
  madeAt: string;
}

type Action = "move" | "done" | "declined";

/**
 * Heat change requests from athletes. Moving someone emails them their new
 * heat and closes the request in one go; the admin fee is collected first,
 * outside the site.
 */
export default function ChangeRequestsPanel({
  requests,
  heats,
  changeFeeCents,
}: {
  requests: ChangeRequest[];
  heats: HeatOption[];
  changeFeeCents: number | null;
}) {
  const router = useRouter();
  const [targets, setTargets] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<{ id: string; action: Action } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [resolved, setResolved] = useState<string[]>([]);

  const fee =
    changeFeeCents && changeFeeCents > 0
      ? `${formatFee(changeFeeCents)} admin fee`
      : "admin fee";

  function targetFor(r: ChangeRequest): string {
    if (r.id in targets) return targets[r.id];
    if (r.requestedHeat && r.requestedHeat !== r.currentHeat) return String(r.requestedHeat);
    return String(firstOpenHeat(heats, r.currentHeat) ?? "");
  }

  function setError(id: string, message: string) {
    setErrors((prev) => ({ ...prev, [id]: message }));
  }

  function finished(message: string) {
    setResolved((prev) => [...prev, message]);
    router.refresh();
  }

  async function move(r: ChangeRequest) {
    const heat = Number(targetFor(r));
    if (!heat) return setError(r.id, "Pick a heat to move them to.");
    if (heat === r.currentHeat) {
      return setError(r.id, `${r.name} is already in Heat ${heat}. Mark it done instead.`);
    }
    setBusy({ id: r.id, action: "move" });
    setError(r.id, "");
    try {
      const data = await sendWithHeatCheck<{ success?: boolean; error?: string; code?: string }>(
        `/api/admin/entries/${r.entryId}`,
        "PATCH",
        { heatNumber: heat, resolveRequestId: r.id, notify: true },
        "Move"
      );
      if (data === "cancelled") return;
      if (data.success) {
        finished(`${r.name} moved to ${heatName(heats, heat)}. They have been emailed.`);
      } else {
        setError(r.id, data.error || "Could not move them");
      }
    } catch {
      setError(r.id, "Could not connect. Try again.");
    } finally {
      setBusy(null);
    }
  }

  async function close(r: ChangeRequest, status: "done" | "declined") {
    if (
      status === "declined" &&
      !window.confirm(
        `Decline ${r.name}'s request? They are not emailed, so let them know yourself.`
      )
    ) {
      return;
    }
    setBusy({ id: r.id, action: status });
    setError(r.id, "");
    try {
      const res = await fetch(`/api/admin/heat-change-requests/${r.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = (await res.json()) as { success?: boolean; error?: string };
      if (data.success) {
        finished(
          status === "done"
            ? `${r.name}'s request marked done.`
            : `${r.name}'s request declined.`
        );
      } else {
        setError(r.id, data.error || "Could not update the request");
      }
    } catch {
      setError(r.id, "Could not connect. Try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="bg-white border border-stone/40 border-t-2 border-t-terracotta">
      <div className="px-4 sm:px-5 py-4 border-b border-stone/30">
        <h2 className="t-headline text-[1.6rem] md:text-[1.8rem]">Heat change requests</h2>
        <p className="mt-1.5 text-sm text-midnight/60 leading-relaxed">
          <span className="t-numeral text-[1.2rem] text-terracotta">{requests.length}</span> waiting
          on you. Collect the {fee} before you move anyone. Moving emails the athlete their new heat.
        </p>
      </div>

      <p
        aria-live="polite"
        className={
          resolved.length
            ? "px-4 sm:px-5 py-2.5 text-xs text-trail font-medium bg-trail/5 border-b border-stone/30"
            : "sr-only"
        }
      >
        {resolved[resolved.length - 1] ?? ""}
      </p>

      <ul className="divide-y divide-stone/30">
        {requests.map((r) => {
          const target = targetFor(r);
          const working = busy?.id === r.id;
          const error = errors[r.id];
          return (
            <li key={r.id} className="px-4 sm:px-5 py-4">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <Link
                  href={`/admin/athletes/${r.userId}`}
                  className="t-headline text-[1.2rem] hover:text-terracotta transition-colors"
                >
                  {r.name}
                </Link>
                <p className="text-xs text-dust" title={r.madeAt}>
                  Asked {r.madeAgo}
                </p>
              </div>
              <p className="text-[11px] text-midnight/50 truncate">{r.email}</p>

              <div className="mt-3 grid grid-cols-2 gap-px bg-stone/40 border border-stone/40">
                <div className="bg-bone/60 px-3 py-2.5">
                  <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-dust">Now</p>
                  <p className="text-sm font-medium mt-0.5">{heatName(heats, r.currentHeat)}</p>
                </div>
                <div className="bg-bone/60 px-3 py-2.5">
                  <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-dust">Wants</p>
                  <p className="text-sm font-medium mt-0.5">
                    {r.requestedHeat ? heatName(heats, r.requestedHeat) : "Any heat"}
                  </p>
                </div>
              </div>

              {r.note && (
                <blockquote className="mt-3 border-l-2 border-stone pl-3 t-caption text-midnight/70 whitespace-pre-line">
                  {r.note}
                </blockquote>
              )}

              <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-2">
                <HeatSelect
                  heats={heats}
                  value={target}
                  onChange={(v) => setTargets((prev) => ({ ...prev, [r.id]: v }))}
                  current={r.currentHeat}
                  placeholder="Pick a heat"
                  ariaLabel={`Move ${r.name} to`}
                  className="h-11 w-full sm:w-64 border border-stone/40 px-3 text-base sm:text-sm bg-bone/50 focus:outline-none focus:border-terracotta transition-colors"
                />
                <button
                  type="button"
                  onClick={() => move(r)}
                  disabled={working || !target}
                  className="btn btn-sm btn-primary whitespace-nowrap"
                >
                  {working && busy?.action === "move" ? "Moving..." : "Move and close"}
                </button>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => close(r, "done")}
                    disabled={working}
                    className="btn btn-sm btn-ghost flex-1 sm:flex-none"
                  >
                    {working && busy?.action === "done" ? "Saving..." : "Mark done"}
                  </button>
                  <button
                    type="button"
                    onClick={() => close(r, "declined")}
                    disabled={working}
                    className="h-11 flex-1 sm:flex-none px-4 text-xs font-medium text-dust hover:text-terracotta transition-colors disabled:opacity-50"
                  >
                    {working && busy?.action === "declined" ? "Saving..." : "Decline"}
                  </button>
                </div>
              </div>

              {error && (
                <p role="alert" className="mt-2 text-xs text-terracotta">
                  {error}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
