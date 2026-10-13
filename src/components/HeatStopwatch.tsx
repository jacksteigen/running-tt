"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { formatSeconds, LONG_TIME_SECONDS } from "@/lib/racetime";
import { OUTCOMES, type Outcome } from "@/lib/outcomes";

export type FinishOutcome = { ok: true } | { ok: false; error: string };

/**
 * A time taken on the stopwatch that is not on the server yet. It lives with
 * the results editor (and in localStorage), not here, so switching heats,
 * searching or reloading never loses it.
 */
export interface StopwatchCapture {
  time: string;
  /** Why the save failed, or null while it is still on its way. */
  error: string | null;
}

export interface StopwatchAthlete {
  userId: string;
  name: string;
  ageGroup: string | null;
  timeDisplay: string | null;
  rank: number | null;
  /** DNF, DNS or DQ, when the athlete has no time. */
  outcome: Outcome | null;
  /** A finish taken here that has not saved yet. */
  capture: StopwatchCapture | null;
}

function clockKey(eventId: string, heat: number) {
  return `rtt-clock-${eventId}-${heat}`;
}

function readClock(key: string): number | null {
  try {
    const value = Number(window.localStorage.getItem(key));
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

/**
 * When each heat's clock started, kept in localStorage so a reload or a
 * locked phone never loses a heat in progress. Another tab on the same
 * device picks up starts and stops too.
 */
export function useHeatClocks(eventId: string, heatNumbers: number[]) {
  const [clocks, setClocks] = useState<Record<number, number>>({});
  const heatList = heatNumbers.join(",");

  useEffect(() => {
    const numbers = heatList ? heatList.split(",").map(Number) : [];
    const load = () => {
      const found: Record<number, number> = {};
      for (const n of numbers) {
        const at = readClock(clockKey(eventId, n));
        if (at) found[n] = at;
      }
      setClocks(found);
    };
    const onStorage = (e: StorageEvent) => {
      if (!e.key || e.key.startsWith(`rtt-clock-${eventId}-`)) load();
    };
    load();
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [eventId, heatList]);

  const start = useCallback(
    (heat: number) => {
      const at = Date.now();
      try {
        window.localStorage.setItem(clockKey(eventId, heat), String(at));
      } catch {
        // Private mode or storage full: the clock still runs, it just will not survive a reload.
      }
      setClocks((prev) => ({ ...prev, [heat]: at }));
    },
    [eventId]
  );

  const stop = useCallback(
    (heat: number) => {
      try {
        window.localStorage.removeItem(clockKey(eventId, heat));
      } catch {
        // Nothing stored, nothing to clear.
      }
      setClocks((prev) => {
        const next = { ...prev };
        delete next[heat];
        return next;
      });
    },
    [eventId]
  );

  return { clocks, start, stop };
}

/** Tenths of a second as 6:03.4, or 1:02:33.4 past the hour. */
function formatTenths(tenths: number) {
  const t = Math.max(0, tenths);
  const hours = Math.floor(t / 36000);
  const minutes = Math.floor((t % 36000) / 600);
  const seconds = String(Math.floor((t % 600) / 10)).padStart(2, "0");
  const tenth = t % 10;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${seconds}.${tenth}`
    : `${minutes}:${seconds}.${tenth}`;
}

/** Wall clock time with seconds: 5:15:02pm. */
function wallClock(ms: number) {
  const d = new Date(ms);
  const h = d.getHours();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${h % 12 || 12}:${pad(d.getMinutes())}:${pad(d.getSeconds())}${h >= 12 ? "pm" : "am"}`;
}

/** The big running clock. Kept separate so only it re-renders each tenth. */
function RunningClock({ startedAt }: { startedAt: number }) {
  const [tenths, setTenths] = useState(() => Math.floor((Date.now() - startedAt) / 100));

  useEffect(() => {
    let frame = 0;
    const tick = () => {
      setTenths(Math.floor((Date.now() - startedAt) / 100));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [startedAt]);

  return (
    <p
      role="timer"
      aria-label="Elapsed time"
      className="t-numeral leading-none text-[4.25rem] sm:text-[5.75rem] md:text-[7rem]"
    >
      {formatTenths(tenths)}
    </p>
  );
}

/**
 * Hand timing for one heat. Start on the gun, then tap each runner as they
 * cross the line; the elapsed time is saved straight away through the same
 * path as a typed time, so the leaderboard moves as the heat finishes.
 */
export default function HeatStopwatch({
  heatNumber,
  heatTime,
  startedAt,
  onStart,
  onStop,
  athletes,
  onFinish,
  onUndo,
  onOutcome,
  onDismiss,
}: {
  heatNumber: number;
  /** "5:45pm", or null while heat times are not set. */
  heatTime: string | null;
  startedAt: number | null;
  onStart: () => void;
  onStop: () => void;
  athletes: StopwatchAthlete[];
  onFinish: (userId: string, time: string) => Promise<FinishOutcome>;
  onUndo: (userId: string) => Promise<boolean>;
  onOutcome: (userId: string, outcome: Outcome) => Promise<boolean>;
  /** Throw away a time that did not save. The editor asks first. */
  onDismiss: (userId: string) => void;
}) {
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState("");
  const pressedAt = useRef<Record<string, number>>({});

  const runners = [...athletes].sort((a, b) => a.name.localeCompare(b.name));
  const untimed = athletes.filter((a) => !a.timeDisplay && !a.outcome).length;
  const notSaved = athletes.filter(
    (a) => a.capture && a.capture.error !== null && !a.timeDisplay && !a.outcome
  ).length;

  /** Set or clear one athlete's entry in a per-athlete map. */
  function patch<T>(
    setter: React.Dispatch<React.SetStateAction<Record<string, T>>>,
    id: string,
    value: NoInfer<T> | undefined
  ) {
    setter((prev) => {
      const next = { ...prev };
      if (value === undefined) delete next[id];
      else next[id] = value;
      return next;
    });
  }

  /** Save a time. A failure is held by the editor as a capture, with a retry. */
  async function record(athlete: StopwatchAthlete, time: string) {
    patch(setBusy, athlete.userId, true);
    patch(setErrors, athlete.userId, undefined);
    const outcome = await onFinish(athlete.userId, time);
    patch(setBusy, athlete.userId, undefined);
    if (outcome.ok) setNotice(`${athlete.name} finished in ${time}.`);
  }

  function finish(athlete: StopwatchAthlete) {
    // Once a time is taken, only a retry or a discard can replace it.
    if (!startedAt || busy[athlete.userId] || athlete.capture) return;
    // Time from the moment the finger landed, not when it lifted.
    const now = Date.now();
    const pressed = pressedAt.current[athlete.userId];
    delete pressedAt.current[athlete.userId];
    const at = pressed && now - pressed < 1500 ? pressed : now;

    const seconds = Math.round(((at - startedAt) / 1000) * 100) / 100;
    if (seconds <= 0) return;
    if (seconds > LONG_TIME_SECONDS) {
      patch(
        setErrors,
        athlete.userId,
        "This clock has been running for over an hour. Stop it and start it again on the gun."
      );
      return;
    }
    record(athlete, formatSeconds(seconds));
  }

  async function undo(athlete: StopwatchAthlete) {
    patch(setBusy, athlete.userId, true);
    patch(setErrors, athlete.userId, undefined);
    const ok = await onUndo(athlete.userId);
    patch(setBusy, athlete.userId, undefined);
    if (ok) {
      setNotice(
        `Cleared ${athlete.name} (was ${
          athlete.timeDisplay ?? (athlete.outcome ? OUTCOMES[athlete.outcome].label : "unmarked")
        }). Tap Finish again or type the time below.`
      );
    } else {
      patch(setErrors, athlete.userId, "Could not undo. Check the signal and try again.");
    }
  }

  async function markDnf(athlete: StopwatchAthlete) {
    if (busy[athlete.userId]) return;
    patch(setBusy, athlete.userId, true);
    patch(setErrors, athlete.userId, undefined);
    const ok = await onOutcome(athlete.userId, "dnf");
    patch(setBusy, athlete.userId, undefined);
    if (ok) setNotice(`${athlete.name} marked DNF.`);
    else patch(setErrors, athlete.userId, "Could not mark DNF. Check the signal and try again.");
  }

  function stop() {
    if (window.confirm(`Stop the Heat ${heatNumber} clock? Times already saved stay saved.`)) {
      onStop();
      setNotice("");
    }
  }

  const note = (
    <p className="t-caption text-stone/55">
      Hand timed on this device. Tap the moment the runner crosses the line.
    </p>
  );

  if (startedAt === null) {
    return (
      <div className="bg-midnight text-white px-4 sm:px-6 py-5 sm:py-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="t-headline text-[1.5rem]">Heat {heatNumber}</p>
            <p className="mt-1 text-sm text-stone/75">
              Hand timing
              {heatTime ? ` · ${heatTime}` : ""}
              <span className="text-stone/40"> · </span>
              {untimed === 0 ? "everyone timed" : `${untimed} to finish`}
              {notSaved > 0 && (
                <span className="text-gold">
                  {" · "}
                  {notSaved} not saved, retry below
                </span>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={onStart}
            className="btn btn-primary btn-lg w-full sm:w-auto min-h-14"
          >
            Start Heat {heatNumber}
          </button>
        </div>
        <div className="mt-4">{note}</div>
      </div>
    );
  }

  return (
    <div className="bg-midnight text-white px-4 sm:px-6 py-5 sm:py-6">
      <div className="flex items-center justify-between gap-3">
        <p className="inline-flex items-center gap-2 t-eyebrow text-terracotta">
          <span className="relative flex h-2 w-2" aria-hidden>
            <span className="absolute inline-flex h-full w-full rounded-full bg-terracotta opacity-75 motion-safe:animate-ping" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-terracotta" />
          </span>
          Heat {heatNumber} running
        </p>
        <button type="button" onClick={stop} className="btn btn-sm btn-light">
          Stop clock
        </button>
      </div>

      <div className="mt-5">
        <RunningClock startedAt={startedAt} />
        <p className="mt-3 text-sm text-stone/55">
          Started <span className="font-mono">{wallClock(startedAt)}</span>
        </p>
      </div>

      {/* One list in a fixed order: a runner's slot turns into their time
          when they finish, so nothing moves under the next tap. */}
      <ul className="mt-6 space-y-2">
        {runners.map((a) => {
          const capture = !a.timeDisplay && !a.outcome ? a.capture : null;
          const saving = !!busy[a.userId] || capture?.error === null;
          const error = errors[a.userId];
          return (
            <li key={a.userId}>
              {a.timeDisplay || a.outcome ? (
                <div className="min-h-14 flex items-center gap-3 px-4 py-2 border border-white/15 bg-white/5">
                  <span className="font-mono text-xs w-6 shrink-0 tabular-nums text-stone/50">
                    {a.rank ? String(a.rank).padStart(2, "0") : "--"}
                  </span>
                  <span className="flex-1 min-w-0 truncate text-stone/80">{a.name}</span>
                  {a.timeDisplay ? (
                    <span className="font-mono text-base font-semibold tabular-nums">{a.timeDisplay}</span>
                  ) : (
                    <span
                      className="font-mono text-sm font-semibold uppercase tracking-[0.15em] text-terracotta"
                      title={a.outcome ? OUTCOMES[a.outcome].name : undefined}
                    >
                      {a.outcome ? OUTCOMES[a.outcome].label : ""}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => undo(a)}
                    disabled={saving}
                    aria-label={a.timeDisplay ? `Undo finish for ${a.name}` : `Undo ${a.outcome ? OUTCOMES[a.outcome].label : ""} for ${a.name}`}
                    className="-mr-2 min-h-11 px-2 text-xs text-stone/60 hover:text-terracotta transition-colors disabled:opacity-40"
                  >
                    {saving ? "..." : "Undo"}
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                {capture ? (
                  // Taken but not on the server yet: hold the slot with the
                  // time so a second tap can never replace it with a later one.
                  <div className="w-full min-w-0 min-h-14 flex items-center justify-between gap-4 px-4 py-2 border border-gold/60 bg-gold/10">
                    <span className="min-w-0">
                      <span className="block font-medium truncate text-white">{a.name}</span>
                      <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.15em] text-gold">
                        <span
                          aria-hidden
                          className={`h-1.5 w-1.5 shrink-0 rounded-full bg-gold ${
                            saving ? "motion-safe:animate-pulse" : ""
                          }`}
                        />
                        {saving ? "Saving" : "Not saved"}
                      </span>
                    </span>
                    <span className="shrink-0 font-mono text-base font-semibold tabular-nums text-gold">
                      {capture.time}
                    </span>
                  </div>
                ) : (
                <button
                  type="button"
                  onPointerDown={() => {
                    pressedAt.current[a.userId] = Date.now();
                  }}
                  onClick={() => finish(a)}
                  disabled={saving}
                  aria-label={`Finish ${a.name}`}
                  className="w-full min-h-14 flex items-center justify-between gap-4 px-4 py-2 bg-white text-midnight text-left select-none touch-manipulation hover:bg-stone active:bg-terracotta active:text-white transition-colors disabled:opacity-60"
                >
                  <span className="min-w-0">
                    <span className="block font-medium truncate">{a.name}</span>
                    <span className="block text-[11px] opacity-60 truncate">
                      {a.ageGroup ?? "No age group"}
                    </span>
                  </span>
                  <span className="shrink-0 font-mono text-sm font-semibold uppercase tracking-[0.15em]">
                    {saving ? "Saving" : "Finish"}
                  </span>
                </button>
                )}
                <button
                  type="button"
                  onClick={() => markDnf(a)}
                  disabled={saving}
                  aria-label={`Mark ${a.name} as did not finish`}
                  className="btn btn-light shrink-0 min-h-14 w-16 px-0 active:bg-terracotta active:border-terracotta"
                >
                  DNF
                </button>
                </div>
              )}
              {capture && capture.error !== null && (
                <div
                  role="alert"
                  className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 border-l-2 border-gold pl-3 text-xs text-stone"
                >
                  <span>
                    {capture.time} not saved. {capture.error}
                  </span>
                  <button
                    type="button"
                    onClick={() => record(a, capture.time)}
                    disabled={saving}
                    className="btn btn-sm btn-light"
                  >
                    Retry <span className="font-mono">{capture.time}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onDismiss(a.userId)}
                    disabled={saving}
                    aria-label={`Discard ${capture.time} for ${a.name}`}
                    className="min-h-11 px-2 text-stone/60 hover:text-terracotta transition-colors disabled:opacity-40"
                  >
                    Discard
                  </button>
                </div>
              )}
              {error && (
                <div
                  role="alert"
                  className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 border-l-2 border-terracotta pl-3 text-xs text-stone"
                >
                  <span>{error}</span>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {untimed === 0 && (
        <p className="mt-5 text-sm text-stone/80">
          Everyone in Heat {heatNumber} is accounted for. Stop the clock when you are ready.
        </p>
      )}

      <p aria-live="polite" className={notice ? "mt-4 text-xs text-stone/80" : "sr-only"}>
        {notice}
      </p>
      <div className="mt-4">{note}</div>
    </div>
  );
}
