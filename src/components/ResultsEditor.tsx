"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  formatSeconds,
  LONG_TIME_SECONDS,
  parseTimeToSeconds,
  stopwatchReading,
  type PrizeSlot,
} from "@/lib/racetime";
import HeatStopwatch, {
  useHeatClocks,
  type FinishOutcome,
  type StopwatchCapture,
} from "@/components/HeatStopwatch";
import type { HeatOption } from "@/components/WalkUpForm";
import { OUTCOMES, type Outcome } from "@/lib/outcomes";
import { formatFee } from "@/lib/money";
import {
  CATEGORY_LABEL,
  CATEGORY_NOUN,
  RACE_CATEGORIES,
  ordinal,
  type PrizeSplit,
  type RaceCategory,
} from "@/lib/categories";

export interface OutcomeMark {
  userId: string;
  outcome: Outcome;
}

interface Entrant {
  userId: string;
  name: string;
  email: string;
  ageGroup: string | null;
  /** The heat they booked, or null when the event has no heat booking. */
  heat: number | null;
  /** The category on their profile now. */
  raceCategory: RaceCategory | null;
}

export interface Standing {
  userId: string;
  rank: number;
  ageGroup: string | null;
  ageGroupRank: number | null;
  timeDisplay: string;
  heat: number;
  prizeCents: number;
  /** The category they were placed in when the event was last re-ranked. */
  raceCategory: RaceCategory | null;
  /** Place among their category, or null without one. */
  categoryRank: number | null;
  /** Fastest in their age group without a prize place. */
  ageGroupAward: boolean;
}

type Tab = "all" | number;

type RowState = {
  /** What is in the box while it differs from the saved time. */
  draft?: string;
  /** Heat typed by hand, for events without heat booking. */
  heat?: string;
  status: "idle" | "saving" | "saved" | "error" | "confirm";
  message?: string;
  /** The over-an-hour time being asked about, and the stopwatch reading of it. */
  asked?: string;
  suggestion?: string | null;
};

type SaveOutcome =
  | { ok: true; standings: Standing[] }
  | { ok: false; error: string; code?: string; suggestion?: string | null };

type ResultsResponse = {
  success?: boolean;
  standings?: Standing[];
  outcomes?: OutcomeMark[];
  error?: string;
  code?: string;
  suggestion?: string | null;
};

type Captures = Record<string, StopwatchCapture>;

function capturesKey(eventId: string) {
  return `rtt-captures-${eventId}`;
}

/** Stopwatch times this device took that are not on the server yet. */
function readCaptures(eventId: string): Captures {
  try {
    const raw = window.localStorage.getItem(capturesKey(eventId));
    const list: unknown = raw ? JSON.parse(raw) : [];
    const found: Captures = {};
    if (!Array.isArray(list)) return found;
    for (const item of list) {
      if (item && typeof item.userId === "string" && typeof item.time === "string" && item.time) {
        found[item.userId] = {
          time: item.time,
          error: typeof item.error === "string" ? item.error : null,
        };
      }
    }
    return found;
  } catch {
    return {};
  }
}

function writeCaptures(eventId: string, captures: Captures) {
  try {
    const key = capturesKey(eventId);
    const list = Object.entries(captures).map(([userId, c]) => ({
      userId,
      time: c.time,
      error: c.error,
    }));
    if (list.length === 0) {
      window.localStorage.removeItem(key);
      return;
    }
    const value = JSON.stringify(list);
    if (window.localStorage.getItem(key) !== value) window.localStorage.setItem(key, value);
  } catch {
    // Private mode or storage full: the times are still held on this page.
  }
}

/** Phones have no colon on the number pad, so 4.32.10 means 4:32.10. */
function normaliseTime(input: string) {
  const t = input.trim().replace(/\s+/g, "");
  if (t.includes(":")) return t;
  const parts = t.split(".");
  if (parts.length < 3) return t;
  return `${parts.slice(0, -1).join(":")}.${parts[parts.length - 1]}`;
}

/**
 * Finish-line results, heat by heat. Every save re-ranks the whole event, so
 * the public leaderboard is live. Times can be typed, or hand timed with the
 * heat stopwatch on a phone at the line.
 */
export default function ResultsEditor({
  eventId,
  eventSlug,
  heats,
  entrants,
  initialStandings,
  initialOutcomes,
  prizes,
  prizeSplit,
  ageGroupPrize,
}: {
  eventId: string;
  eventSlug: string;
  /** Empty for events without heat booking. */
  heats: HeatOption[];
  entrants: Entrant[];
  initialStandings: Standing[];
  /** Athletes marked DNF, DNS or DQ. They never have a time. */
  initialOutcomes: OutcomeMark[];
  prizes: PrizeSlot[];
  /** "category" pays every prize place once to the women and once to the men. */
  prizeSplit: PrizeSplit;
  /** What each age group winner without a prize place gets, or null for none. */
  ageGroupPrize: string | null;
}) {
  const router = useRouter();
  const withHeats = heats.length > 0;
  const byCategory = prizeSplit === "category";
  const [rows, setRows] = useState<Record<string, RowState>>({});
  const [standings, setStandings] = useState<Standing[]>(initialStandings);
  const [filter, setFilter] = useState("");

  const [outcomes, setOutcomes] = useState<OutcomeMark[]>(initialOutcomes);

  // A refresh brings fresh standings from the server; take them.
  const [seenInitial, setSeenInitial] = useState(initialStandings);
  if (initialStandings !== seenInitial) {
    setSeenInitial(initialStandings);
    setStandings(initialStandings);
  }
  const [seenOutcomes, setSeenOutcomes] = useState(initialOutcomes);
  if (initialOutcomes !== seenOutcomes) {
    setSeenOutcomes(initialOutcomes);
    setOutcomes(initialOutcomes);
  }

  const outcomeByUser = useMemo(
    () => new Map(outcomes.map((o) => [o.userId, o.outcome])),
    [outcomes]
  );

  /** Timed or marked DNF/DNS/DQ: nothing left to record for them. */
  function accounted(userId: string) {
    return standingByUser.has(userId) || outcomeByUser.has(userId);
  }

  /** Take what the server says after any save or clear. */
  function applyResponse(data: ResultsResponse) {
    if (data.standings) setStandings(data.standings);
    if (data.outcomes) setOutcomes(data.outcomes);
  }

  const standingByUser = useMemo(
    () => new Map(standings.map((s) => [s.userId, s])),
    [standings]
  );
  const entrantById = useMemo(
    () => new Map(entrants.map((e) => [e.userId, e])),
    [entrants]
  );

  // Stopwatch times not on the server yet, by athlete. They live here and on
  // this device, never inside the stopwatch, so a heat switch, a search or a
  // reload cannot lose one. null until localStorage has been read.
  const [captures, setCaptures] = useState<Captures | null>(null);

  useEffect(() => {
    const restored = readCaptures(eventId);
    // A save still on its way when the page closed never came back.
    for (const c of Object.values(restored)) {
      if (c.error === null) c.error = "The page closed before it saved.";
    }
    setCaptures(restored);
    const key = capturesKey(eventId);
    const onStorage = (e: StorageEvent) => {
      if (e.key === key) setCaptures(readCaptures(eventId));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [eventId]);

  useEffect(() => {
    if (captures) writeCaptures(eventId, captures);
  }, [eventId, captures]);

  // Done with once the athlete has a saved time or a DNF, DNS or DQ, or is no
  // longer on the start list.
  if (captures) {
    const stale = Object.keys(captures).filter(
      (id) => !entrantById.has(id) || standingByUser.has(id) || outcomeByUser.has(id)
    );
    if (stale.length > 0) {
      const next = { ...captures };
      for (const id of stale) delete next[id];
      setCaptures(next);
    }
  }
  const unsaved: Captures = captures ?? {};

  // Open on the first heat that still has someone to time.
  const [tab, setTab] = useState<Tab>(() => {
    if (!withHeats) return "all";
    const timed = new Set([
      ...initialStandings.map((s) => s.userId),
      ...initialOutcomes.map((o) => o.userId),
    ]);
    const next = heats.find((h) =>
      entrants.some((e) => e.heat === h.number && !timed.has(e.userId))
    );
    return next ? next.number : "all";
  });
  const activeTab: Tab =
    tab !== "all" && !heats.some((h) => h.number === tab) ? "all" : tab;

  const { clocks, start, stop } = useHeatClocks(
    eventId,
    heats.map((h) => h.number)
  );

  const inputRefs = useRef(new Map<string, HTMLInputElement>());
  const tabRefs = useRef(new Map<Tab, HTMLButtonElement>());
  const stripRef = useRef<HTMLDivElement>(null);
  const visibleRef = useRef<Entrant[]>([]);

  const heatStats = useMemo(() => {
    const stats = new Map<number, { total: number; timed: number }>();
    for (const h of heats) stats.set(h.number, { total: 0, timed: 0 });
    for (const e of entrants) {
      const s = e.heat ? stats.get(e.heat) : undefined;
      if (!s) continue;
      s.total += 1;
      if (standingByUser.has(e.userId) || outcomeByUser.has(e.userId)) s.timed += 1;
    }
    return stats;
  }, [heats, entrants, standingByUser, outcomeByUser]);

  const query = filter.trim().toLowerCase();
  const visible = useMemo(() => {
    let list = entrants;
    if (query) {
      list = list.filter(
        (e) =>
          e.name.toLowerCase().includes(query) ||
          e.email.toLowerCase().includes(query)
      );
    } else if (activeTab !== "all") {
      list = list.filter((e) => e.heat === activeTab);
    }
    // Finishers in order, then those still to record, then DNF/DNS/DQ.
    const order = (id: string) =>
      standingByUser.get(id)?.rank ?? (outcomeByUser.has(id) ? 20000 : 10000);
    return [...list].sort((a, b) => {
      const ra = order(a.userId);
      const rb = order(b.userId);
      if (ra !== rb) return ra - rb;
      return a.name.localeCompare(b.name);
    });
  }, [entrants, query, activeTab, standingByUser, outcomeByUser]);

  useEffect(() => {
    visibleRef.current = visible;
  }, [visible]);

  // Keep the selected heat in view in the tab strip.
  useEffect(() => {
    const strip = stripRef.current;
    const el = tabRefs.current.get(activeTab);
    if (!strip || !el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    strip.scrollTo({
      left: Math.max(0, el.offsetLeft - strip.clientWidth / 2 + el.clientWidth / 2),
      behavior: reduce ? "auto" : "smooth",
    });
  }, [activeTab]);

  function update(userId: string, patch: Partial<RowState>) {
    setRows((prev) => ({
      ...prev,
      [userId]: { ...(prev[userId] ?? { status: "idle" }), ...patch },
    }));
  }

  /** Back to showing the saved time, keeping any hand-typed heat. */
  function settle(userId: string, status: RowState["status"], message?: string) {
    setRows((prev) => ({
      ...prev,
      [userId]: { heat: prev[userId]?.heat, status, message },
    }));
  }

  function heatFor(userId: string): number | undefined {
    if (withHeats) return entrantById.get(userId)?.heat ?? undefined;
    const typed = Number(rows[userId]?.heat ?? standingByUser.get(userId)?.heat ?? 1);
    return Number.isInteger(typed) && typed > 0 ? typed : undefined;
  }

  /** The one save path, shared by typed times and the stopwatch. */
  async function submit(userId: string, time: string, confirmLong = false): Promise<SaveOutcome> {
    try {
      const res = await fetch("/api/admin/results", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId,
          userId,
          time,
          heat: heatFor(userId),
          confirmLong: confirmLong || undefined,
        }),
      });
      const data = (await res.json()) as ResultsResponse;
      if (data.success && data.standings) {
        applyResponse(data);
        router.refresh();
        return { ok: true, standings: data.standings };
      }
      return {
        ok: false,
        error: data.error || "Could not save",
        code: data.code,
        suggestion: data.suggestion ?? null,
      };
    } catch {
      return { ok: false, error: "Could not connect. Check the signal and try again." };
    }
  }

  async function clearResult(userId: string): Promise<boolean> {
    try {
      const res = await fetch("/api/admin/results", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, userId }),
      });
      const data = (await res.json()) as ResultsResponse;
      if (data.success && data.standings) {
        applyResponse(data);
        router.refresh();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  /** Mark DNF, DNS or DQ. Removes any time they had and re-ranks. */
  async function markOutcome(userId: string, outcome: Outcome): Promise<boolean> {
    try {
      const res = await fetch("/api/admin/results", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, userId, outcome }),
      });
      const data = (await res.json()) as ResultsResponse;
      if (data.success && data.standings) {
        applyResponse(data);
        router.refresh();
        return true;
      }
      update(userId, { status: "error", message: data.error || "Could not save" });
      return false;
    } catch {
      update(userId, { status: "error", message: "Could not connect. Check the signal and try again." });
      return false;
    }
  }

  async function outcomeRow(userId: string, outcome: Outcome) {
    const had = standingByUser.get(userId)?.timeDisplay;
    update(userId, { status: "saving", message: undefined });
    if (await markOutcome(userId, outcome)) {
      setRows((prev) => ({
        ...prev,
        [userId]: {
          heat: prev[userId]?.heat,
          draft: "",
          status: "idle",
          message: had ? `Marked ${OUTCOMES[outcome].label}. Time ${had} removed.` : undefined,
        },
      }));
      focusNext(userId, standings);
    }
  }

  function focusNext(savedId: string, latest: Standing[]) {
    const timed = new Set(latest.map((s) => s.userId));
    const next = visibleRef.current.find(
      (e) => e.userId !== savedId && !timed.has(e.userId) && !outcomeByUser.has(e.userId)
    );
    if (next) requestAnimationFrame(() => inputRefs.current.get(next.userId)?.focus());
  }

  async function saveRow(
    userId: string,
    opts: { time?: string; confirmLong?: boolean; advance?: boolean } = {}
  ) {
    const typed =
      opts.time ?? rows[userId]?.draft ?? standingByUser.get(userId)?.timeDisplay ?? "";
    const time = normaliseTime(typed);
    if (!time) return;

    // Catch "6:03:31" before it is saved as six hours.
    if (!opts.confirmLong) {
      const seconds = parseTimeToSeconds(time);
      if (seconds === null) {
        update(userId, {
          status: "error",
          message: `"${typed.trim()}" is not a time we can read. Try 4:32.10`,
        });
        return;
      }
      if (seconds > LONG_TIME_SECONDS) {
        const reading = stopwatchReading(time);
        update(userId, {
          draft: typed,
          status: "confirm",
          asked: time,
          suggestion: reading?.display ?? null,
          message: `"${time}" reads as ${formatSeconds(seconds)}, over an hour.${
            reading ? ` Did you mean ${reading.display}?` : ""
          }`,
        });
        return;
      }
    }

    // Retrying a stopwatch time that did not save: show it as on its way
    // everywhere, and keep it if this attempt fails too.
    const capture = unsaved[userId];
    const forCapture = !!capture && capture.time === time;

    update(userId, { draft: typed, status: "saving", message: undefined });
    if (forCapture) putCapture(userId, { time, error: null });
    const outcome = await submit(userId, time, opts.confirmLong);
    if (!outcome.ok && forCapture) putCapture(userId, { time, error: outcome.error });
    if (outcome.ok) {
      dropCapture(userId);
      settle(userId, "saved");
      setTimeout(
        () =>
          setRows((prev) =>
            prev[userId]?.status === "saved"
              ? { ...prev, [userId]: { ...prev[userId], status: "idle" } }
              : prev
          ),
        1800
      );
      if (opts.advance) focusNext(userId, outcome.standings);
    } else if (outcome.code === "LONG_TIME") {
      update(userId, {
        status: "confirm",
        asked: time,
        suggestion: outcome.suggestion ?? null,
        message: outcome.error,
      });
    } else if (forCapture) {
      // The stopwatch warning on the row carries this error, with a retry.
      update(userId, { status: "idle", message: undefined });
    } else {
      update(userId, { status: "error", message: outcome.error });
    }
  }

  async function clearRow(userId: string) {
    const marked = outcomeByUser.get(userId);
    const was =
      standingByUser.get(userId)?.timeDisplay ?? (marked ? OUTCOMES[marked].label : undefined);
    update(userId, { status: "saving", message: undefined });
    if (await clearResult(userId)) {
      setRows((prev) => ({
        ...prev,
        [userId]: {
          heat: prev[userId]?.heat,
          draft: "",
          status: "idle",
          message: was ? `Cleared. Was ${was}.` : undefined,
        },
      }));
    } else {
      update(userId, { status: "error", message: "Could not clear. Try again." });
    }
  }

  function putCapture(userId: string, capture: StopwatchCapture) {
    setCaptures((prev) => ({ ...(prev ?? {}), [userId]: capture }));
  }

  function dropCapture(userId: string) {
    setCaptures((prev) => {
      if (!prev || !(userId in prev)) return prev;
      const next = { ...prev };
      delete next[userId];
      return next;
    });
  }

  function dismissCapture(userId: string) {
    const capture = unsaved[userId];
    if (!capture) return;
    const name = entrantById.get(userId)?.name ?? "this athlete";
    if (
      window.confirm(
        `Discard the stopwatch time ${capture.time} for ${name}? It has not been saved, and it cannot be got back.`
      )
    ) {
      dropCapture(userId);
    }
  }

  async function finishFromClock(userId: string, time: string): Promise<FinishOutcome> {
    // Hold the time before it goes anywhere, so a bad signal, a heat switch
    // or a reload mid-save never loses it.
    putCapture(userId, { time, error: null });
    const outcome = await submit(userId, time);
    if (outcome.ok) {
      dropCapture(userId);
      settle(userId, "idle");
      return { ok: true };
    }
    putCapture(userId, { time, error: outcome.error });
    if (outcome.code === "LONG_TIME") {
      update(userId, {
        draft: time,
        status: "confirm",
        asked: time,
        suggestion: outcome.suggestion ?? null,
        message: outcome.error,
      });
    }
    return { ok: false, error: outcome.error };
  }

  async function undoFromClock(userId: string): Promise<boolean> {
    const ok = await clearResult(userId);
    if (ok) settle(userId, "idle");
    return ok;
  }

  function selectTab(next: Tab) {
    setTab(next);
    setFilter("");
  }

  function onTabKey(e: React.KeyboardEvent) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const order: Tab[] = ["all", ...heats.map((h) => h.number)];
    const i = order.indexOf(activeTab);
    const next = order[(i + (e.key === "ArrowRight" ? 1 : -1) + order.length) % order.length];
    selectTab(next);
    tabRefs.current.get(next)?.focus();
  }

  if (entrants.length === 0) {
    return (
      <div className="bg-white border border-stone/40">
        <div className="px-4 sm:px-5 py-4 border-b border-stone/30">
          <h2 className="t-headline text-[1.6rem] md:text-[1.8rem]">Live results</h2>
        </div>
        <p className="px-4 sm:px-5 py-6 text-[0.95rem] text-midnight/60 max-w-lg leading-relaxed">
          Nobody to time yet. Athletes appear here once their entry is
          confirmed. Add walk-ups in the start list below, or put the QR code
          on a screen and let them sign themselves up.
        </p>
      </div>
    );
  }

  const done = standings.length;
  const marked = outcomes.length;
  const currentHeat = activeTab === "all" ? null : heats.find((h) => h.number === activeTab) ?? null;
  const heatEntrants = currentHeat ? entrants.filter((e) => e.heat === currentHeat.number) : [];

  // Stopwatch times that failed to save (not ones still on their way). Each
  // heat tab flags its own, and anything outside this view gets a pointer.
  const failedIds = Object.keys(unsaved).filter((id) => unsaved[id].error !== null);
  const tabFor = (id: string): Tab => {
    const h = entrantById.get(id)?.heat;
    return h && heats.some((x) => x.number === h) ? h : "all";
  };
  const failedByTab = new Map<Tab, number>();
  for (const id of failedIds) {
    const t = tabFor(id);
    if (t !== "all") failedByTab.set(t, (failedByTab.get(t) ?? 0) + 1);
  }
  failedByTab.set("all", failedIds.length);
  const shownIds = new Set(visible.map((e) => e.userId));
  const failedElsewhere = failedIds.filter((id) => !shownIds.has(id));
  const elsewhereTabs = [...new Set(failedElsewhere.map(tabFor))];

  // The top three, or the top three women and the top three men when the
  // event pays each of them.
  const leaderBoards: {
    key: string;
    category: RaceCategory | null;
    rows: { s: Standing; place: number }[];
  }[] = byCategory
    ? RACE_CATEGORIES.map((c) => ({
        key: c,
        category: c,
        rows: standings
          .filter((s) => s.raceCategory === c && s.categoryRank)
          .sort((a, b) => (a.categoryRank as number) - (b.categoryRank as number))
          .slice(0, 3)
          .map((s) => ({ s, place: s.categoryRank as number })),
      }))
    : [
        {
          key: "overall",
          category: null,
          rows: standings.slice(0, 3).map((s) => ({ s, place: s.rank })),
        },
      ];

  // Paid to women and men, nobody without a category can win a prize place.
  // Anyone marked DNF, DNS or DQ is out of it anyway.
  const uncategorised = byCategory
    ? entrants.filter((e) => {
        if (outcomeByUser.has(e.userId)) return false;
        return !e.raceCategory || standingByUser.get(e.userId)?.raceCategory === null;
      })
    : [];
  const uncategorisedFinished = uncategorised.filter((e) => standingByUser.has(e.userId));
  const uncategorisedToRace = uncategorised.filter((e) => !standingByUser.has(e.userId));

  function tabButton(key: Tab, title: string, sub: string, timed: number, total: number) {
    const selected = activeTab === key;
    const running = key !== "all" && !!clocks[key];
    const complete = total > 0 && timed === total;
    const failed = failedByTab.get(key) ?? 0;
    return (
      <button
        key={String(key)}
        ref={(el) => {
          if (el) tabRefs.current.set(key, el);
          else tabRefs.current.delete(key);
        }}
        type="button"
        role="tab"
        id={`results-tab-${key}`}
        aria-selected={selected}
        aria-controls="results-panel"
        tabIndex={selected ? 0 : -1}
        onClick={() => selectTab(key)}
        title={
          failed > 0
            ? `${failed} stopwatch ${failed === 1 ? "time" : "times"} not saved`
            : undefined
        }
        className={`shrink-0 min-w-[4.75rem] px-3 pt-3 pb-2.5 text-left border-b-2 -mb-px transition-colors ${
          selected
            ? "border-terracotta text-midnight bg-bone/40"
            : "border-transparent text-midnight/50 hover:text-midnight"
        }`}
      >
        <span className="flex items-center gap-1.5 font-mono text-xs font-semibold uppercase tracking-[0.15em]">
          {title}
          {running && (
            <>
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-terracotta" />
              <span className="sr-only">(clock running)</span>
            </>
          )}
          {failed > 0 && (
            <>
              <span aria-hidden className="h-2 w-2 rounded-full bg-gold ring-2 ring-gold/25" />
              <span className="sr-only">
                ({failed} stopwatch {failed === 1 ? "time" : "times"} not saved)
              </span>
            </>
          )}
        </span>
        <span className="block font-mono text-[10px] text-dust mt-0.5 whitespace-nowrap">
          {sub}
        </span>
        <span className={`block t-numeral text-[0.95rem] mt-1 ${complete ? "text-trail" : ""}`}>
          {timed}/{total}
        </span>
      </button>
    );
  }

  return (
    <div className="bg-white border border-stone/40">
      <div className="px-4 sm:px-5 py-4 border-b border-stone/30 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="t-headline text-[1.6rem] md:text-[1.8rem]">Live results</h2>
          <p className="mt-1.5 text-sm text-midnight/60">
            <span className="t-numeral text-[1.2rem] text-midnight">{done}</span> of{" "}
            <span className="t-numeral text-[1.2rem] text-midnight">{entrants.length}</span> timed
            {marked > 0 && <> · {marked} DNF, DNS or DQ</>}
          </p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <input
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Find an athlete"
            aria-label="Find an athlete"
            className="min-w-0 flex-1 sm:flex-none sm:w-48 h-11 border border-stone/40 px-3 text-base sm:text-sm bg-bone/50 focus:outline-none focus:border-terracotta transition-colors"
          />
          <Link
            href={`/events/${eventSlug}`}
            target="_blank"
            className="btn btn-sm btn-ghost whitespace-nowrap"
          >
            Public board
          </Link>
        </div>
      </div>

      {uncategorised.length > 0 && (
        <div className="px-4 sm:px-5 py-3 border-b border-gold/50 bg-gold/10">
          <p className="text-sm text-midnight leading-relaxed">
            <span className="font-semibold">
              {uncategorised.length} {uncategorised.length === 1 ? "athlete has" : "athletes have"} no
              category.
            </span>{" "}
            <span className="text-midnight/75">
              This race pays women and men separately, so{" "}
              {uncategorised.length === 1
                ? "they cannot be placed for prize money until it is set on their profile."
                : "none of them can be placed for prize money until it is set on each profile."}
            </span>
          </p>
          {uncategorisedFinished.length > 0 && (
            <NameLinks label="Finished" people={uncategorisedFinished} />
          )}
          {uncategorisedToRace.length > 0 && (
            <NameLinks label="Still to race" people={uncategorisedToRace} />
          )}
        </div>
      )}

      {leaderBoards.map((board) =>
        board.rows.length > 0 ? (
          <ol
            key={board.key}
            aria-label={board.category ? `${CATEGORY_LABEL[board.category]} leaders` : "Leaders"}
            className="grid grid-cols-3 border-b border-stone/30 divide-x divide-stone/30"
          >
            {board.rows.map(({ s, place }) => (
              <li key={s.userId} className="px-3 sm:px-5 py-3 min-w-0">
                <p className={`t-eyebrow truncate ${place === 1 ? "text-gold" : "text-dust"}`}>
                  {ordinal(place)}
                  {board.category ? ` ${CATEGORY_NOUN[board.category]}` : ""}
                </p>
                <p className="t-headline text-[1.05rem] truncate mt-1">
                  {entrantById.get(s.userId)?.name ?? "Athlete"}
                </p>
                <p className="t-numeral text-[1.35rem] mt-1">{s.timeDisplay}</p>
              </li>
            ))}
          </ol>
        ) : null
      )}

      {withHeats && (
        <div
          ref={stripRef}
          role="tablist"
          aria-label="Heats"
          onKeyDown={onTabKey}
          className="relative flex overflow-x-auto border-b border-stone/30 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {tabButton("all", "All", "Every heat", done + marked, entrants.length)}
          {heats.map((h) => {
            const s = heatStats.get(h.number) ?? { total: 0, timed: 0 };
            const sub = h.startTime
              ? h.label
              : h.offsetMinutes === 0
                ? "Start"
                : `+${h.offsetMinutes} min`;
            return tabButton(h.number, `H${h.number}`, sub, s.timed, s.total);
          })}
        </div>
      )}

      <div
        id="results-panel"
        role={withHeats ? "tabpanel" : undefined}
        aria-labelledby={withHeats ? `results-tab-${activeTab}` : undefined}
      >
        {query && withHeats && (
          <p className="px-4 sm:px-5 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-dust bg-bone/60 border-b border-stone/30">
            Searching every heat
          </p>
        )}

        {failedElsewhere.length > 0 && (
          <div className="px-4 sm:px-5 py-2 border-b border-gold/50 bg-gold/10 flex flex-wrap items-center gap-x-3 gap-y-1">
            <p className="flex-1 min-w-[12rem] text-xs text-midnight leading-relaxed">
              <span aria-hidden className="inline-block h-2 w-2 rounded-full bg-gold mr-2 align-middle" />
              {failedElsewhere.length} stopwatch{" "}
              {failedElsewhere.length === 1 ? "time" : "times"} not saved outside this view.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {elsewhereTabs.map((t) => (
                <button
                  key={String(t)}
                  type="button"
                  onClick={() => selectTab(t)}
                  className="btn btn-sm btn-ghost"
                >
                  {t === "all" ? "Show all" : `Show H${t}`}
                </button>
              ))}
            </div>
          </div>
        )}

        {currentHeat && !query && heatEntrants.length > 0 && (
          <HeatStopwatch
            key={currentHeat.number}
            heatNumber={currentHeat.number}
            heatTime={currentHeat.startTime ? currentHeat.label : null}
            startedAt={clocks[currentHeat.number] ?? null}
            onStart={() => start(currentHeat.number)}
            onStop={() => stop(currentHeat.number)}
            athletes={heatEntrants.map((e) => {
              const s = standingByUser.get(e.userId);
              return {
                userId: e.userId,
                name: e.name,
                ageGroup: e.ageGroup,
                raceCategory: byCategory ? e.raceCategory : null,
                timeDisplay: s?.timeDisplay ?? null,
                rank: s?.rank ?? null,
                outcome: outcomeByUser.get(e.userId) ?? null,
                capture: unsaved[e.userId] ?? null,
              };
            })}
            onFinish={finishFromClock}
            onUndo={undoFromClock}
            onDismiss={dismissCapture}
            onOutcome={async (userId, outcome) => {
              const ok = await markOutcome(userId, outcome);
              if (ok) settle(userId, "idle");
              return ok;
            }}
          />
        )}

        {visible.length === 0 ? (
          <p className="px-4 sm:px-5 py-8 text-[0.95rem] text-midnight/55">
            {query
              ? `Nobody matches "${filter.trim()}".`
              : currentHeat
                ? `Nobody is booked into Heat ${currentHeat.number}.`
                : "Nobody to show."}
          </p>
        ) : (
          <div className="divide-y divide-stone/30">
            {visible.map((entrant) => {
              const row = rows[entrant.userId] ?? { status: "idle" as const };
              const standing = standingByUser.get(entrant.userId);
              const mark = outcomeByUser.get(entrant.userId);
              const capture = unsaved[entrant.userId];
              const value = row.draft ?? standing?.timeDisplay ?? "";
              const meta = [
                entrant.ageGroup ?? "No age group",
                withHeats && (activeTab === "all" || query)
                  ? entrant.heat
                    ? `H${entrant.heat}`
                    : "No heat"
                  : null,
                byCategory && standing?.categoryRank && standing.raceCategory
                  ? `${ordinal(standing.categoryRank)} ${CATEGORY_NOUN[standing.raceCategory]}`
                  : null,
                standing?.ageGroupRank ? `${ordinal(standing.ageGroupRank)} in group` : null,
                standing && standing.prizeCents > 0 ? formatFee(standing.prizeCents) : null,
                standing?.ageGroupAward ? ageGroupPrize || "Age group prize" : null,
              ]
                .filter(Boolean)
                .join(" · ");
              // Gold for a winner: 1st overall, or 1st woman or man.
              const winner = byCategory ? standing?.categoryRank === 1 : standing?.rank === 1;

              return (
                <div key={entrant.userId} className="px-4 sm:px-5 py-3">
                  <div className="flex flex-wrap sm:flex-nowrap items-center gap-x-3 gap-y-2">
                    <span
                      className={`font-mono text-sm w-8 shrink-0 tabular-nums ${
                        mark
                          ? "text-terracotta font-semibold text-xs"
                          : winner
                            ? "text-gold font-semibold"
                            : standing
                              ? "text-midnight"
                              : "text-stone"
                      }`}
                      title={mark ? OUTCOMES[mark].name : undefined}
                    >
                      {mark
                        ? OUTCOMES[mark].label
                        : standing
                          ? String(standing.rank).padStart(2, "0")
                          : "--"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <p className="t-headline text-[1.1rem] truncate">{entrant.name}</p>
                        {(entrant.raceCategory || byCategory) && (
                          <CategoryTag category={entrant.raceCategory} flag={byCategory} />
                        )}
                      </div>
                      <p className="text-[11px] text-midnight/50 truncate">{meta}</p>
                    </div>
                    <div
                      className={`flex items-center gap-2 w-full sm:w-auto sm:pl-0 ${
                        withHeats ? "pl-11" : ""
                      }`}
                    >
                      {!withHeats && (
                        <label className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-dust">
                          <span className="sm:hidden" aria-hidden>H</span>
                          <span className="hidden sm:inline" aria-hidden>Heat</span>
                          <input
                            type="number"
                            inputMode="numeric"
                            min={1}
                            value={row.heat ?? String(standing?.heat ?? 1)}
                            onChange={(e) => update(entrant.userId, { heat: e.target.value })}
                            className="w-12 sm:w-14 h-11 border border-stone/40 px-2 text-base sm:text-sm font-mono bg-bone/50 focus:outline-none focus:border-terracotta transition-colors"
                            aria-label={`Heat for ${entrant.name}`}
                          />
                        </label>
                      )}
                      <input
                        ref={(el) => {
                          if (el) inputRefs.current.set(entrant.userId, el);
                          else inputRefs.current.delete(entrant.userId);
                        }}
                        type="text"
                        inputMode="decimal"
                        autoComplete="off"
                        value={value}
                        onChange={(e) =>
                          update(entrant.userId, {
                            draft: e.target.value,
                            status: "idle",
                            message: undefined,
                          })
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            saveRow(entrant.userId, { advance: true });
                          }
                        }}
                        placeholder="4:32.10"
                        aria-label={`Finish time for ${entrant.name}`}
                        aria-invalid={row.status === "error" || row.status === "confirm"}
                        className={`min-w-0 flex-1 sm:flex-none sm:w-28 h-11 border px-3 text-base sm:text-sm font-mono tabular-nums bg-bone/50 focus:outline-none focus:border-terracotta transition-colors ${
                          row.status === "error" || row.status === "confirm"
                            ? "border-terracotta"
                            : "border-stone/40"
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => saveRow(entrant.userId)}
                        disabled={row.status === "saving" || !value.trim()}
                        className={`btn btn-sm min-w-[4.75rem] ${
                          row.status === "saved" ? "bg-trail text-bone" : "btn-ink"
                        }`}
                      >
                        {row.status === "saving"
                          ? "Saving"
                          : row.status === "saved"
                            ? "Saved"
                            : standing
                              ? "Update"
                              : "Save"}
                      </button>
                      {(standing || mark) && (
                        <button
                          type="button"
                          onClick={() => clearRow(entrant.userId)}
                          disabled={row.status === "saving"}
                          aria-label={`Clear ${mark ? OUTCOMES[mark].label : "time"} for ${entrant.name}`}
                          className="h-11 px-2 text-xs text-dust hover:text-terracotta transition-colors disabled:opacity-40"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>

                  {capture &&
                    (capture.error === null ? (
                      <p className="mt-2 sm:ml-11 flex items-center gap-2 text-xs text-midnight/60">
                        <span
                          aria-hidden
                          className="h-1.5 w-1.5 shrink-0 rounded-full bg-gold motion-safe:animate-pulse"
                        />
                        Saving stopwatch time{" "}
                        <span className="font-mono tabular-nums">{capture.time}</span>
                      </p>
                    ) : (
                      <div
                        role="alert"
                        className="mt-2 sm:ml-11 border border-gold/60 bg-gold/10 px-3 py-2.5"
                      >
                        <p className="text-xs text-midnight leading-relaxed">
                          <span className="font-semibold">
                            Stopwatch time{" "}
                            <span className="font-mono tabular-nums">{capture.time}</span> not
                            saved.
                          </span>{" "}
                          <span className="text-midnight/70">{capture.error}</span>
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => saveRow(entrant.userId, { time: capture.time })}
                            disabled={row.status === "saving"}
                            className="btn btn-sm btn-ink"
                          >
                            {row.status === "saving" ? (
                              "Saving"
                            ) : (
                              <>
                                Retry <span className="font-mono">{capture.time}</span>
                              </>
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => dismissCapture(entrant.userId)}
                            disabled={row.status === "saving"}
                            aria-label={`Discard ${capture.time} for ${entrant.name}`}
                            className="btn btn-sm btn-ghost"
                          >
                            Discard
                          </button>
                        </div>
                      </div>
                    ))}

                  <div
                    role="group"
                    aria-label={`Did not finish options for ${entrant.name}`}
                    className="mt-2 sm:ml-11 flex items-center gap-1.5"
                  >
                    {(Object.keys(OUTCOMES) as Outcome[]).map((o) => (
                      <button
                        key={o}
                        type="button"
                        onClick={() => outcomeRow(entrant.userId, o)}
                        disabled={row.status === "saving" || mark === o}
                        aria-pressed={mark === o}
                        title={OUTCOMES[o].name}
                        className={`btn btn-sm min-w-[3.5rem] px-3 ${
                          mark === o ? "btn-primary disabled:opacity-100 disabled:cursor-default" : "btn-ghost"
                        }`}
                      >
                        {OUTCOMES[o].label}
                      </button>
                    ))}
                    <span className="text-[11px] text-midnight/40 ml-1 hidden sm:inline">
                      {mark ? OUTCOMES[mark].name : "No time to record?"}
                    </span>
                  </div>

                  {row.status === "confirm" && row.message && (
                    <div
                      role="alert"
                      className="mt-2 sm:ml-11 border border-gold/50 bg-gold/10 px-3 py-2.5"
                    >
                      <p className="text-xs text-midnight leading-relaxed">{row.message}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {row.suggestion && (
                          <button
                            type="button"
                            onClick={() => saveRow(entrant.userId, { time: row.suggestion as string })}
                            className="btn btn-sm btn-ink"
                          >
                            Use <span className="font-mono">{row.suggestion}</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() =>
                            saveRow(entrant.userId, { time: row.asked, confirmLong: true })
                          }
                          className="btn btn-sm btn-ghost"
                        >
                          Keep as typed
                        </button>
                      </div>
                    </div>
                  )}
                  {row.status === "error" && row.message && (
                    <p role="alert" className="mt-2 sm:ml-11 text-xs text-terracotta">
                      {row.message}
                    </p>
                  )}
                  {row.status === "idle" && row.message && (
                    <p aria-live="polite" className="mt-2 sm:ml-11 text-xs text-midnight/50">
                      {row.message}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="px-4 sm:px-5 py-4 border-t border-stone/30 text-xs text-midnight/50 leading-relaxed">
        {withHeats
          ? "Pick a heat, start the clock on the gun and tap runners home, or type a time and press Enter. "
          : "Type a time and press Enter. "}
        On a phone, 4.32.10 works as well as 4:32.10. DNF, DNS and DQ never count toward places,
        prizes or personal bests, and DNS is only shown here. Every save re-ranks the whole event
        {prizes.length === 0
          ? "."
          : byCategory
            ? " and pays each prize place once to the women and once to the men."
            : " and assigns prize money down the finishing order."}{" "}
        {ageGroupPrize &&
          `${ageGroupPrize} goes to the fastest in each age group without a prize place. `}
        The public leaderboard refreshes itself.
      </div>
    </div>
  );
}

/** W or M beside a name, or a flag when the athlete has not set one. */
export function CategoryTag({
  category,
  flag,
}: {
  category: RaceCategory | null;
  /** The event pays women and men, so a missing category matters. */
  flag: boolean;
}) {
  const base = "shrink-0 t-eyebrow text-[0.62rem] leading-none px-1.5 py-1 border";
  if (category) {
    return (
      <span title={CATEGORY_LABEL[category]} className={`${base} border-stone/60 text-dust`}>
        <span aria-hidden>{CATEGORY_LABEL[category].charAt(0)}</span>
        <span className="sr-only">{CATEGORY_LABEL[category]}</span>
      </span>
    );
  }
  return (
    <span
      className={`${base} whitespace-nowrap ${
        flag ? "border-terracotta/50 text-terracotta" : "border-stone/60 text-dust"
      }`}
    >
      No category
    </span>
  );
}

/** A labelled line of athletes, each linking to their admin profile. */
function NameLinks({ label, people }: { label: string; people: Entrant[] }) {
  return (
    <p className="mt-2 text-sm text-midnight leading-relaxed">
      <span className="t-eyebrow text-dust mr-2">{label}</span>
      {people.map((p, i) => (
        <span key={p.userId}>
          {i > 0 && ", "}
          <Link
            href={`/admin/athletes/${p.userId}`}
            className="link-quiet hover:text-terracotta transition-colors"
          >
            {p.name}
          </Link>
        </span>
      ))}
    </p>
  );
}
