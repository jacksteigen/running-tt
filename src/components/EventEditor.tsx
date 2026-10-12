"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { buildHeats, formatClock, heatWindow, isValidClock } from "@/lib/heats";
import { dateParts } from "@/lib/dates";
import { EVENT_STATUSES, slugify } from "@/lib/eventInput";
import type { PrizeSlot } from "@/lib/racetime";

export type EventStatus = (typeof EVENT_STATUSES)[number];

/** The admin event form exactly as the API takes it. Money is in dollars. */
export interface EventFormValues {
  name: string;
  distance: string;
  dateTbc: boolean;
  date: string;
  venue: string;
  location: string;
  status: EventStatus;
  entryFee: number;
  changeFee: number | null;
  startTime: string;
  heatsEnabled: boolean;
  firstHeatTime: string;
  heatIntervalMinutes: number;
  heatCount: number;
  heatCapacity: number;
  prizes: PrizeSlot[];
  description: string;
  checkIn: string;
  whatToBring: string[];
}

interface PrizeRow {
  key: number;
  label: string;
  amount: string;
}

/** What the inputs hold. Numbers stay as text so a field can be cleared. */
interface Draft {
  name: string;
  distance: string;
  dateTbc: boolean;
  date: string;
  venue: string;
  location: string;
  status: EventStatus;
  entryFee: string;
  changeFee: string;
  startTime: string;
  heatsEnabled: boolean;
  firstHeatTime: string;
  heatIntervalMinutes: string;
  heatCount: string;
  heatCapacity: string;
  prizes: PrizeRow[];
  description: string;
  checkIn: string;
  whatToBring: string;
}

const DISTANCE_PICKS = ["Mile", "2K", "3K", "5K", "10K"];

const STATUS_OPTIONS: { value: EventStatus; help: string; dot: string }[] = [
  { value: "Coming Soon", help: "Listed on the site. Booking stays closed.", dot: "bg-dust" },
  { value: "Open", help: "Open means athletes can book now.", dot: "bg-trail" },
  { value: "Sold Out", help: "Listed as sold out. Nobody else can book.", dot: "bg-terracotta" },
];

const statusChip: Record<string, string> = {
  Open: "bg-trail text-white",
  "Sold Out": "bg-terracotta text-white",
  "Coming Soon": "bg-stone text-midnight/70",
};

const MAX_PRIZES = 20;

const inputCls =
  "w-full border border-stone/50 px-3 py-2.5 text-base sm:text-sm bg-bone/40 placeholder:text-midnight/30 focus:outline-none focus:border-terracotta focus:bg-white transition-colors disabled:opacity-45 disabled:cursor-not-allowed";
const labelCls = "block text-xs font-medium text-dust mb-1.5";
const helpCls = "mt-1.5 text-xs text-midnight/55 leading-relaxed";

function toDraft(v: EventFormValues): Draft {
  return {
    name: v.name,
    distance: v.distance,
    dateTbc: v.dateTbc,
    date: v.date,
    venue: v.venue,
    location: v.location,
    status: v.status,
    entryFee: String(v.entryFee),
    changeFee: v.changeFee === null ? "" : String(v.changeFee),
    startTime: v.startTime,
    heatsEnabled: v.heatsEnabled,
    firstHeatTime: v.firstHeatTime,
    heatIntervalMinutes: String(v.heatIntervalMinutes),
    heatCount: String(v.heatCount),
    heatCapacity: String(v.heatCapacity),
    prizes: v.prizes.map((p, i) => ({ key: i, label: p.label, amount: p.amount })),
    description: v.description,
    checkIn: v.checkIn,
    whatToBring: v.whatToBring.join("\n"),
  };
}

function toPayload(d: Draft): EventFormValues {
  return {
    name: d.name.trim(),
    distance: d.distance.trim(),
    dateTbc: d.dateTbc,
    date: d.dateTbc ? "" : d.date,
    venue: d.venue.trim(),
    location: d.location.trim(),
    status: d.status,
    entryFee: d.entryFee.trim() === "" ? 0 : Number(d.entryFee),
    changeFee: d.changeFee.trim() === "" ? null : Number(d.changeFee),
    startTime: d.heatsEnabled ? "" : d.startTime.trim(),
    heatsEnabled: d.heatsEnabled,
    firstHeatTime: d.heatsEnabled ? d.firstHeatTime : "",
    heatIntervalMinutes: Number(d.heatIntervalMinutes),
    heatCount: Number(d.heatCount),
    heatCapacity: Number(d.heatCapacity),
    prizes: d.prizes
      .map((p) => ({ label: p.label.trim(), amount: p.amount.trim() }))
      .filter((p) => p.label || p.amount),
    description: d.description.trim(),
    checkIn: d.checkIn.trim(),
    whatToBring: d.whatToBring
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean),
  };
}

/** A whole number inside the range, or null. Mirrors the server's checks. */
function intIn(value: string, min: number, max: number): number | null {
  if (value.trim() === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const r = Math.round(n);
  return r >= min && r <= max ? r : null;
}

function dollarsOk(value: string): boolean {
  if (value.trim() === "") return true;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 && n <= 1000;
}

/** Empty cells needed to finish the last row of a grid. */
function padCells(items: number, columns: number): number {
  return (columns - (items % columns)) % columns;
}

function money(dollars: number): string {
  return `$${dollars % 1 === 0 ? dollars.toFixed(0) : dollars.toFixed(2)}`;
}

/**
 * Create or edit an event: what and where, when, heat booking, money,
 * prizes and race-day details. The server re-checks everything; the checks
 * here only exist so mistakes show up before the round trip.
 */
export default function EventEditor({
  mode,
  eventId,
  slug,
  initial,
  bookedCount,
  heatBooked = {},
  canDelete,
  stripeTestMode,
}: {
  mode: "create" | "edit";
  eventId?: string;
  /** The event's current web address, in edit mode. */
  slug?: string;
  initial: EventFormValues;
  /** Confirmed and pending entries. */
  bookedCount: number;
  /** Athletes holding a spot in each heat, by heat number. */
  heatBooked?: Record<number, number>;
  canDelete: boolean;
  stripeTestMode: boolean;
}) {
  const router = useRouter();
  const [initialDraft] = useState(() => toDraft(initial));
  const [d, setD] = useState<Draft>(initialDraft);
  const [nextPrizeKey, setNextPrizeKey] = useState(initial.prizes.length);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const dirty = useMemo(
    () => JSON.stringify(toPayload(d)) !== JSON.stringify(toPayload(initialDraft)),
    [d, initialDraft]
  );

  // Closing the tab with unsaved work asks first.
  useEffect(() => {
    if (!dirty || done) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, done]);

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setD((prev) => ({ ...prev, [key]: value }));
    setError("");
  }

  // What existing bookings pin in place.
  const bookedHeats = Object.entries(heatBooked)
    .filter(([, n]) => n > 0)
    .map(([h, n]) => ({ heat: Number(h), n }));
  const maxBookedHeat = bookedHeats.reduce((m, b) => Math.max(m, b.heat), 0);
  const maxInHeat = bookedHeats.reduce((m, b) => Math.max(m, b.n), 0);
  const heatsLocked = bookedHeats.length > 0;

  const interval = intIn(d.heatIntervalMinutes, 1, 240);
  const count = intIn(d.heatCount, 1, 50);
  const capacity = intIn(d.heatCapacity, 1, 500);
  const firstHeat = isValidClock(d.firstHeatTime) ? d.firstHeatTime : null;
  const heatConfig = {
    first_heat_time: firstHeat,
    heat_interval_minutes: interval,
    heat_count: count,
    heat_capacity: capacity,
  };
  const heats = interval && count && capacity ? buildHeats(heatConfig) : [];
  const windowText = heats.length ? heatWindow(heatConfig) : null;

  const heatCountWarning =
    count !== null && maxBookedHeat > count
      ? `Heat ${maxBookedHeat} has bookings. Move those athletes before cutting the number of heats.`
      : "";
  const capacityWarning =
    capacity !== null && maxInHeat > capacity
      ? `One heat already has ${maxInHeat} athletes, more than the new limit.`
      : "";

  const openNeedsDate = d.dateTbc || !d.date;
  const openNeedsHeat = d.heatsEnabled && !firstHeat;
  const openBlocked = d.status === "Open" && (openNeedsDate || openNeedsHeat);

  const fee = d.entryFee.trim() === "" ? 0 : Number(d.entryFee);
  const changeFee = d.changeFee.trim() === "" ? null : Number(d.changeFee);
  const address = mode === "edit" && slug ? slug : slugify(d.name) || "your-event";

  /** The first thing stopping a save, and the field to send the admin to. */
  function problem(): { message: string; field: string } | null {
    if (d.name.trim().length < 3) return { message: "Give the event a name", field: "ev-name" };
    if (!d.distance.trim()) {
      return { message: "Set the distance, for example 2K or 400m uphill", field: "ev-distance" };
    }
    if (!d.dateTbc && !d.date) return { message: "Set a date, or tick Date TBC", field: "ev-date" };
    if (d.heatsEnabled) {
      if (interval === null) {
        return { message: "Heat interval must be 1 to 240 minutes", field: "ev-interval" };
      }
      if (count === null) return { message: "Number of heats must be 1 to 50", field: "ev-count" };
      if (capacity === null) {
        return { message: "Athletes per heat must be 1 to 500", field: "ev-capacity" };
      }
      if (d.firstHeatTime && !firstHeat) {
        return { message: "First heat time does not look right", field: "ev-first-heat" };
      }
      if (heatCountWarning) return { message: heatCountWarning, field: "ev-count" };
      if (capacityWarning) return { message: capacityWarning, field: "ev-capacity" };
    }
    if (d.status === "Open" && openNeedsDate) {
      return { message: "An event needs a date before it can open for bookings", field: "ev-date" };
    }
    if (d.status === "Open" && openNeedsHeat) {
      return { message: "Set the first heat time before opening bookings", field: "ev-first-heat" };
    }
    if (!dollarsOk(d.entryFee)) {
      return { message: "Entry fee must be between $0 and $1,000", field: "ev-fee" };
    }
    if (!dollarsOk(d.changeFee)) {
      return { message: "Change fee must be between $0 and $1,000", field: "ev-change-fee" };
    }
    const half = d.prizes.find((p) => !!p.label.trim() !== !!p.amount.trim());
    if (half) {
      return { message: "Give each prize a place and an amount", field: `ev-prize-${half.key}-label` };
    }
    return null;
  }

  function focusField(id: string) {
    const el = document.getElementById(id);
    if (!el) return;
    if (el instanceof HTMLInputElement && el.disabled) {
      document.getElementById("ev-tbc")?.focus();
      return;
    }
    el.focus({ preventScroll: true });
    el.scrollIntoView({ block: "center" });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving || done) return;
    const p = problem();
    if (p) {
      setError(p.message);
      focusField(p.field);
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch(
        mode === "create" ? "/api/admin/events" : `/api/admin/events/${eventId}`,
        {
          method: mode === "create" ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(toPayload(d)),
        }
      );
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        slug?: string;
        error?: string;
      };
      if (data.success && data.slug) {
        setDone(true);
        router.push(`/admin/events/${data.slug}`);
        router.refresh();
        return;
      }
      setError(data.error || "Could not save the event");
    } catch {
      setError("Could not connect. Try again.");
    }
    setSaving(false);
  }

  async function handleDelete() {
    if (!eventId || deleting) return;
    const name = initial.name || "this event";
    if (!window.confirm(`Delete ${name}? This cannot be undone.`)) return;
    setDeleting(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/events/${eventId}`, { method: "DELETE" });
      const data = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };
      if (data.success) {
        setDone(true);
        router.push("/admin");
        router.refresh();
        return;
      }
      setError(data.error || "Could not delete the event");
    } catch {
      setError("Could not connect. Try again.");
    }
    setDeleting(false);
  }

  function updatePrize(key: number, patch: Partial<PrizeRow>) {
    set(
      "prizes",
      d.prizes.map((p) => (p.key === key ? { ...p, ...patch } : p))
    );
  }

  function addPrize() {
    if (d.prizes.length >= MAX_PRIZES) return;
    const key = nextPrizeKey;
    setNextPrizeKey(key + 1);
    set("prizes", [...d.prizes, { key, label: "", amount: "" }]);
    // Let the new row render, then put the cursor in it.
    requestAnimationFrame(() => document.getElementById(`ev-prize-${key}-label`)?.focus());
  }

  function removePrize(key: number) {
    set(
      "prizes",
      d.prizes.filter((p) => p.key !== key)
    );
  }

  const bringCount = d.whatToBring.split("\n").filter((l) => l.trim()).length;
  const cancelHref = mode === "edit" && slug ? `/admin/events/${slug}` : "/admin";
  const busy = saving || deleting || done;

  const sections = [
    { id: "basics", label: "Basics" },
    { id: "when", label: "When" },
    { id: "heats", label: "Heats" },
    { id: "money", label: "Money" },
    { id: "prizes", label: "Prizes" },
    { id: "details", label: "Details" },
  ];

  return (
    <form onSubmit={handleSubmit} noValidate className="bg-bone">
      <div className="mx-auto max-w-6xl px-6 py-10 md:py-14 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_18rem] gap-8 lg:gap-10">
        <div className="space-y-6 min-w-0">
          {/* 01 Basics */}
          <Section id="basics" n="01" kicker="Basics" title="What and where">
            <div>
              <label htmlFor="ev-name" className={labelCls}>
                Event name
              </label>
              <input
                id="ev-name"
                value={d.name}
                maxLength={80}
                onChange={(e) => set("name", e.target.value)}
                placeholder="2K Time Trial"
                className={inputCls}
              />
              <p className={`${helpCls} font-mono break-all`}>
                runningtt.com/events/<span className="text-midnight">{address}</span>
              </p>
              {mode === "create" && (
                <p className="text-[11px] text-midnight/45 mt-0.5">
                  Set from the name. A number is added if it is already taken.
                </p>
              )}
            </div>

            <div>
              <label htmlFor="ev-distance" className={labelCls}>
                Distance
              </label>
              <input
                id="ev-distance"
                value={d.distance}
                maxLength={40}
                onChange={(e) => set("distance", e.target.value)}
                placeholder="2K, or anything like 400m uphill"
                className={inputCls}
              />
              <div role="group" aria-label="Common distances" className="mt-2 flex flex-wrap gap-2">
                {DISTANCE_PICKS.map((pick) => {
                  const active = d.distance.trim().toLowerCase() === pick.toLowerCase();
                  return (
                    <button
                      key={pick}
                      type="button"
                      aria-pressed={active}
                      onClick={() => set("distance", pick)}
                      className={`min-h-11 min-w-[3.25rem] px-4 font-mono text-xs uppercase tracking-[0.15em] border transition-colors ${
                        active
                          ? "bg-midnight border-midnight text-white"
                          : "bg-white border-stone/60 text-midnight/70 hover:border-midnight/40 hover:text-midnight"
                      }`}
                    >
                      {pick}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-4">
              <div>
                <label htmlFor="ev-venue" className={labelCls}>
                  Venue
                </label>
                <input
                  id="ev-venue"
                  value={d.venue}
                  maxLength={80}
                  onChange={(e) => set("venue", e.target.value)}
                  placeholder="Landy Field"
                  className={inputCls}
                />
                <p className={helpCls}>Blank shows as Venue TBC.</p>
              </div>
              <div>
                <label htmlFor="ev-location" className={labelCls}>
                  Location
                </label>
                <input
                  id="ev-location"
                  value={d.location}
                  maxLength={80}
                  onChange={(e) => set("location", e.target.value)}
                  placeholder="Geelong, VIC"
                  className={inputCls}
                />
                <p className={helpCls}>Blank shows as Location TBC.</p>
              </div>
            </div>
          </Section>

          {/* 02 When */}
          <Section id="when" n="02" kicker="When" title="Date and status">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-4">
              <div>
                <label htmlFor="ev-date" className={labelCls}>
                  Date
                </label>
                <input
                  id="ev-date"
                  type="date"
                  value={d.dateTbc ? "" : d.date}
                  disabled={d.dateTbc}
                  onChange={(e) => set("date", e.target.value)}
                  className={`${inputCls} [color-scheme:light]`}
                />
                <label className="mt-1 flex items-center gap-2.5 min-h-11 cursor-pointer select-none">
                  <input
                    id="ev-tbc"
                    type="checkbox"
                    checked={d.dateTbc}
                    onChange={(e) => set("dateTbc", e.target.checked)}
                    className="h-4 w-4 accent-[#C4593A]"
                  />
                  <span className="text-sm">Date TBC</span>
                  <span className="text-xs text-midnight/45">Listed, but not bookable</span>
                </label>
              </div>
              <div>
                {d.heatsEnabled ? (
                  <>
                    <p className={labelCls}>Start time</p>
                    <div className="border border-dashed border-stone/70 px-3 py-2.5 text-sm text-midnight/60 min-h-11 flex items-center">
                      {firstHeat ? (
                        <span>
                          <span className="font-mono text-midnight">{formatClock(firstHeat)}</span> from the first heat
                        </span>
                      ) : (
                        "Set by the first heat below"
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <label htmlFor="ev-start" className={labelCls}>
                      Start time
                    </label>
                    <input
                      id="ev-start"
                      value={d.startTime}
                      maxLength={40}
                      onChange={(e) => set("startTime", e.target.value)}
                      placeholder="5:00pm"
                      className={inputCls}
                    />
                    <p className={helpCls}>Shown as written. Blank shows as Time TBC.</p>
                  </>
                )}
              </div>
            </div>

            <fieldset>
              <legend className={labelCls}>Status</legend>
              <div className="grid grid-cols-1 sm:grid-cols-3 border border-stone/60 divide-y sm:divide-y-0 sm:divide-x divide-stone/60">
                {STATUS_OPTIONS.map((opt) => {
                  const selected = d.status === opt.value;
                  return (
                    <label
                      key={opt.value}
                      className={`relative cursor-pointer px-4 py-3.5 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-inset has-[:focus-visible]:ring-terracotta ${
                        selected ? "bg-midnight text-white" : "bg-white hover:bg-bone"
                      }`}
                    >
                      <input
                        type="radio"
                        name="ev-status"
                        value={opt.value}
                        checked={selected}
                        onChange={() => set("status", opt.value)}
                        className="sr-only"
                      />
                      <span className="flex items-center gap-2 text-sm font-medium">
                        <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${opt.dot}`} />
                        {opt.value}
                      </span>
                      <span
                        className={`block text-xs mt-1 leading-relaxed ${
                          selected ? "text-stone/70" : "text-midnight/55"
                        }`}
                      >
                        {opt.help}
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <div
              aria-live="polite"
              className={`border px-4 py-3.5 transition-colors ${
                openBlocked ? "border-terracotta/50 bg-terracotta/5" : "border-stone/50 bg-bone/50"
              }`}
            >
              <p className={`text-xs font-medium ${openBlocked ? "text-terracotta" : "text-midnight/70"}`}>
                {openBlocked
                  ? "This event cannot open yet. It still needs:"
                  : d.heatsEnabled
                    ? "To open bookings, an event needs a date and a first heat time."
                    : "To open bookings, an event needs a date."}
              </p>
              <ul className="mt-2 space-y-1.5">
                <RuleItem
                  met={!openNeedsDate}
                  label={!openNeedsDate ? "Date set" : "A date, not TBC"}
                  onFix={() => focusField("ev-date")}
                />
                {d.heatsEnabled && (
                  <RuleItem
                    met={!openNeedsHeat}
                    label={!openNeedsHeat ? "First heat time set" : "A first heat time"}
                    onFix={() => focusField("ev-first-heat")}
                  />
                )}
              </ul>
            </div>
          </Section>

          {/* 03 Heats */}
          <Section id="heats" n="03" kicker="Heats" title="Heat booking">
            <button
              type="button"
              role="switch"
              aria-checked={d.heatsEnabled}
              aria-labelledby="ev-heats-label"
              aria-describedby="ev-heats-desc"
              disabled={heatsLocked && d.heatsEnabled}
              onClick={() => set("heatsEnabled", !d.heatsEnabled)}
              className="w-full flex items-center justify-between gap-4 min-h-11 text-left disabled:cursor-not-allowed group"
            >
              <span className="min-w-0">
                <span id="ev-heats-label" className="block text-sm font-medium">
                  Athletes book a heat
                </span>
                <span id="ev-heats-desc" className="block text-xs text-midnight/55 mt-0.5 leading-relaxed">
                  {heatsLocked
                    ? "Athletes are booked into heats, so heat booking stays on."
                    : "They pick a start time when they book, like choosing a flight."}
                </span>
              </span>
              <span
                aria-hidden
                className={`relative inline-block h-7 w-12 shrink-0 border transition-colors group-disabled:opacity-60 ${
                  d.heatsEnabled ? "bg-trail border-trail" : "bg-stone/70 border-stone"
                }`}
              >
                <span
                  className={`absolute top-[2px] left-[2px] h-[22px] w-[22px] bg-white shadow-sm motion-safe:transition-transform motion-safe:duration-200 ${
                    d.heatsEnabled ? "translate-x-[20px]" : "translate-x-0"
                  }`}
                />
              </span>
            </button>

            {d.heatsEnabled && (
              <div className="space-y-5 motion-safe:animate-page-in">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label htmlFor="ev-first-heat" className={labelCls}>
                      First heat
                    </label>
                    <input
                      id="ev-first-heat"
                      type="time"
                      step={60}
                      value={d.firstHeatTime}
                      onChange={(e) => set("firstHeatTime", e.target.value)}
                      className={`${inputCls} font-mono [color-scheme:light]`}
                    />
                  </div>
                  <div>
                    <label htmlFor="ev-interval" className={labelCls}>
                      Minutes apart
                    </label>
                    <input
                      id="ev-interval"
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={240}
                      value={d.heatIntervalMinutes}
                      onChange={(e) => set("heatIntervalMinutes", e.target.value)}
                      className={`${inputCls} font-mono`}
                    />
                  </div>
                  <div>
                    <label htmlFor="ev-count" className={labelCls}>
                      Heats
                    </label>
                    <input
                      id="ev-count"
                      type="number"
                      inputMode="numeric"
                      min={Math.max(1, maxBookedHeat)}
                      max={50}
                      value={d.heatCount}
                      onChange={(e) => set("heatCount", e.target.value)}
                      aria-invalid={!!heatCountWarning || undefined}
                      className={`${inputCls} font-mono`}
                    />
                  </div>
                  <div>
                    <label htmlFor="ev-capacity" className={labelCls}>
                      Athletes per heat
                    </label>
                    <input
                      id="ev-capacity"
                      type="number"
                      inputMode="numeric"
                      min={Math.max(1, maxInHeat)}
                      max={500}
                      value={d.heatCapacity}
                      onChange={(e) => set("heatCapacity", e.target.value)}
                      aria-invalid={!!capacityWarning || undefined}
                      className={`${inputCls} font-mono`}
                    />
                  </div>
                </div>
                <p className="-mt-2 text-xs text-midnight/55 leading-relaxed">
                  {d.dateTbc
                    ? "The first heat can stay blank while the date is TBC."
                    : "Change the first heat and every heat moves with it."}
                </p>

                {bookedCount > 0 && (
                  <p className="border-l-2 border-gold bg-gold/10 px-4 py-3 text-xs text-midnight/75 leading-relaxed">
                    <span className="font-medium text-midnight">
                      {bookedCount} {bookedCount === 1 ? "athlete is" : "athletes are"} booked.
                    </span>{" "}
                    Heats with bookings cannot be removed, and a heat cannot hold fewer
                    athletes than are already in it.
                  </p>
                )}

                {(heatCountWarning || capacityWarning) && (
                  <div role="alert" className="space-y-1">
                    {heatCountWarning && <p className="text-sm text-terracotta">{heatCountWarning}</p>}
                    {capacityWarning && <p className="text-sm text-terracotta">{capacityWarning}</p>}
                  </div>
                )}

                {/* Live schedule */}
                <div className="border border-stone/50">
                  <div className="px-4 py-3 bg-midnight text-white flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-stone/60">
                      Schedule
                    </p>
                    <p className="font-mono text-xs tabular-nums" aria-live="polite">
                      {heats.length && capacity ? (
                        <>
                          {heats.length} {heats.length === 1 ? "heat" : "heats"} · {heats.length * capacity} spots
                          {windowText ? ` · ${windowText}` : ""}
                        </>
                      ) : (
                        "Set the heats to see the schedule"
                      )}
                    </p>
                  </div>
                  {heats.length > 0 ? (
                    <>
                      <ol className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-px bg-stone/40">
                        {heats.map((h) => {
                          const booked = heatBooked[h.number] ?? 0;
                          const pct = Math.min(100, Math.round((booked / h.capacity) * 100));
                          return (
                            <li key={h.number} className="bg-white px-3 py-2.5 min-w-0">
                              <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-dust">
                                Heat {h.number}
                              </p>
                              <p
                                className={`font-mono tabular-nums mt-0.5 ${
                                  h.startTime ? "text-sm text-midnight" : "text-[11px] text-midnight/55 leading-snug"
                                }`}
                              >
                                {h.label}
                              </p>
                              {booked > 0 && (
                                <>
                                  <p className="font-mono text-[10px] text-midnight/55 mt-1 tabular-nums">
                                    {booked}/{h.capacity} booked
                                  </p>
                                  <div className="mt-1 h-0.5 bg-stone/50" aria-hidden>
                                    <div
                                      className={`h-full ${booked >= h.capacity ? "bg-terracotta" : "bg-trail"}`}
                                      style={{ width: `${pct}%` }}
                                    />
                                  </div>
                                </>
                              )}
                            </li>
                          );
                        })}
                        {/* Fill the last row at each column count so the grid reads as a clean block. */}
                        {Array.from({ length: padCells(heats.length, 6) }).map((_, i) => (
                          <li
                            key={`pad-${i}`}
                            aria-hidden
                            className={`bg-white ${i < padCells(heats.length, 3) ? "block" : "hidden"} ${
                              i < padCells(heats.length, 4) ? "sm:block" : "sm:hidden"
                            } ${i < padCells(heats.length, 6) ? "md:block" : "md:hidden"}`}
                          />
                        ))}
                      </ol>
                      {!firstHeat && (
                        <p className="px-4 py-2.5 text-[11px] text-midnight/55 border-t border-stone/40">
                          Clock times appear once the first heat is set. Athletes see them when booking opens.
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="px-4 py-6 text-sm text-midnight/55 text-center">
                      Number of heats 1 to 50, every 1 to 240 minutes, up to 500 athletes each.
                    </p>
                  )}
                </div>
              </div>
            )}
          </Section>

          {/* 04 Money */}
          <Section id="money" n="04" kicker="Money" title="Entry and fees">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-4">
              <div>
                <label htmlFor="ev-fee" className={labelCls}>
                  Entry fee
                </label>
                <MoneyInput
                  id="ev-fee"
                  value={d.entryFee}
                  onChange={(v) => set("entryFee", v)}
                  placeholder="0"
                />
                <p className={helpCls}>
                  {fee > 0 && Number.isFinite(fee)
                    ? `Athletes pay ${money(fee)} AUD by card when they book.`
                    : "0 makes it free. Athletes book without paying."}
                </p>
              </div>
              <div>
                <label htmlFor="ev-change-fee" className={labelCls}>
                  Heat change admin fee <span className="text-midnight/40 font-normal">(optional)</span>
                </label>
                <MoneyInput
                  id="ev-change-fee"
                  value={d.changeFee}
                  onChange={(v) => set("changeFee", v)}
                  placeholder="Not set"
                />
                <p className={helpCls}>Shown to athletes when they ask to change heats.</p>
              </div>
            </div>

            {stripeTestMode && fee > 0 && (
              <div role="note" className="border border-gold bg-gold/15 px-4 py-3.5 flex gap-3">
                <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
                <p className="text-sm text-midnight leading-relaxed">
                  <span className="font-semibold">Stripe is in test mode.</span> Paid bookings cannot
                  take real money until live keys are added.
                </p>
              </div>
            )}

            {d.heatsEnabled && (
              <p className="text-xs text-midnight/55 leading-relaxed border-t border-stone/40 pt-4">
                Athletes read:{" "}
                <span className="text-midnight/80">
                  &ldquo;Heat changes are made by our team
                  {changeFee !== null && changeFee > 0 && Number.isFinite(changeFee)
                    ? ` and carry a ${money(changeFee)} admin fee.`
                    : " and an admin fee applies."}
                  &rdquo;
                </span>
              </p>
            )}
          </Section>

          {/* 05 Prizes */}
          <Section id="prizes" n="05" kicker="Prizes" title="Prize money">
            {d.prizes.length === 0 ? (
              <p className="text-sm text-midnight/55">No prizes yet. Add a place and what it wins.</p>
            ) : (
              <ul className="space-y-2">
                {d.prizes.map((p, i) => (
                  <li key={p.key} className="flex items-center gap-2">
                    <span className="font-mono text-[10px] text-dust w-5 shrink-0 tabular-nums" aria-hidden>
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <input
                      id={`ev-prize-${p.key}-label`}
                      value={p.label}
                      maxLength={40}
                      onChange={(e) => updatePrize(p.key, { label: e.target.value })}
                      placeholder="1st"
                      aria-label={`Prize ${i + 1} place`}
                      className={`${inputCls} w-24 sm:w-40 shrink-0`}
                    />
                    <input
                      id={`ev-prize-${p.key}-amount`}
                      value={p.amount}
                      maxLength={40}
                      onChange={(e) => updatePrize(p.key, { amount: e.target.value })}
                      placeholder="$100"
                      aria-label={`Prize ${i + 1} amount`}
                      className={`${inputCls} min-w-0 flex-1 font-mono`}
                    />
                    <button
                      type="button"
                      onClick={() => removePrize(p.key)}
                      aria-label={`Remove prize ${i + 1}`}
                      className="h-11 w-11 shrink-0 flex items-center justify-center border border-stone/50 text-midnight/50 hover:text-terracotta hover:border-terracotta/50 transition-colors"
                    >
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
                        <path d="M2 2l10 10M12 2L2 12" />
                      </svg>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <button
              type="button"
              onClick={addPrize}
              disabled={d.prizes.length >= MAX_PRIZES}
              className="min-h-11 px-4 text-sm font-medium text-terracotta border border-terracotta/30 hover:bg-terracotta/5 transition-colors disabled:opacity-40"
            >
              + Add prize
            </button>
          </Section>

          {/* 06 Details */}
          <Section id="details" n="06" kicker="Details" title="Race-day details">
            <div>
              <label htmlFor="ev-description" className={labelCls}>
                Description
              </label>
              <textarea
                id="ev-description"
                rows={4}
                maxLength={1500}
                value={d.description}
                onChange={(e) => set("description", e.target.value)}
                placeholder="Two laps and a bit of Landy Field. Rolling heats every 15 minutes, live results as each heat finishes."
                className={inputCls}
              />
              <p className="mt-1 text-[11px] text-midnight/40 text-right tabular-nums">
                {d.description.length} / 1500
              </p>
            </div>
            <div>
              <label htmlFor="ev-checkin" className={labelCls}>
                Check-in
              </label>
              <textarea
                id="ev-checkin"
                rows={3}
                maxLength={600}
                value={d.checkIn}
                onChange={(e) => set("checkIn", e.target.value)}
                placeholder="Check in at the finish line tent 20 minutes before your heat."
                className={inputCls}
              />
            </div>
            <div>
              <label htmlFor="ev-bring" className={labelCls}>
                What to bring
              </label>
              <textarea
                id="ev-bring"
                rows={4}
                value={d.whatToBring}
                onChange={(e) => set("whatToBring", e.target.value)}
                placeholder={"Racing flats or spikes\nWater bottle\nA warm layer for after"}
                aria-describedby="ev-bring-help"
                className={inputCls}
              />
              <p id="ev-bring-help" className={helpCls}>
                One item per line, up to 20.
                {bringCount > 0 ? ` ${bringCount} ${bringCount === 1 ? "item" : "items"}.` : ""}
              </p>
            </div>
          </Section>

          {mode === "edit" && (
            <div className="pt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
              {canDelete ? (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={busy}
                  className="min-h-11 text-sm text-midnight/50 hover:text-terracotta underline-offset-4 hover:underline transition-colors disabled:opacity-40"
                >
                  {deleting ? "Deleting..." : "Delete event"}
                </button>
              ) : (
                <p className="text-xs text-midnight/45">
                  Events with entries or results cannot be deleted.
                </p>
              )}
            </div>
          )}
        </div>

        {/* At a glance, desktop only */}
        <aside className="hidden lg:block" aria-label="Event preview">
          <div className="sticky top-24 space-y-6">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-dust mb-2">
                At a glance
              </p>
              <Glance
                draft={d}
                heatsSummary={
                  d.heatsEnabled
                    ? heats.length && capacity
                      ? `${heats.length} ${heats.length === 1 ? "heat" : "heats"} · ${heats.length * capacity} spots`
                      : "Heats not set"
                    : null
                }
                timeText={d.heatsEnabled ? windowText ?? "Time TBC" : d.startTime.trim() || "Time TBC"}
                feeText={fee > 0 && Number.isFinite(fee) ? `${money(fee)} AUD` : "Free"}
              />
            </div>
            <nav aria-label="Form sections">
              <ul className="border-l border-stone/60">
                {sections.map((s, i) => (
                  <li key={s.id}>
                    <a
                      href={`#${s.id}`}
                      className="flex items-center gap-3 pl-4 py-1.5 text-sm text-midnight/60 hover:text-terracotta transition-colors"
                    >
                      <span className="font-mono text-[10px] text-dust tabular-nums">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      {s.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </aside>
      </div>

      {/* Save bar: sits above the tab bar on phones */}
      <div className="sticky bottom-[calc(4.25rem+env(safe-area-inset-bottom))] md:bottom-0 z-40 border-t border-stone/60 bg-bone/90 backdrop-blur-md">
        <div className="mx-auto max-w-6xl px-6 py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
          <div className={error ? "flex-1 min-w-0" : "hidden sm:block flex-1 min-w-0"}>
            {error ? (
              <p role="alert" className="text-sm text-terracotta leading-snug">
                {error}
              </p>
            ) : (
              <p aria-live="polite" className="hidden sm:flex items-center gap-2 text-xs text-midnight/55">
                {dirty && !done && (
                  <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-terracotta" />
                )}
                {done
                  ? "Saved"
                  : dirty
                    ? "Unsaved changes"
                    : mode === "create"
                      ? "New events start as Coming Soon unless you choose otherwise."
                      : "No changes yet"}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href={cancelHref}
              className="min-h-11 px-4 flex items-center justify-center text-sm text-midnight/60 hover:text-midnight transition-colors"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={busy}
              className="flex-1 sm:flex-none min-h-11 bg-terracotta text-white text-sm font-medium px-7 hover:bg-terracotta/90 transition-colors disabled:opacity-60"
            >
              {done
                ? "Saved"
                : saving
                  ? mode === "create"
                    ? "Creating..."
                    : "Saving..."
                  : mode === "create"
                    ? "Create event"
                    : "Save changes"}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}

function Section({
  id,
  n,
  kicker,
  title,
  children,
}: {
  id: string;
  n: string;
  kicker: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className="bg-white border border-stone/40 scroll-mt-24"
    >
      <header className="px-5 md:px-7 pt-6 pb-5 border-b border-stone/30">
        <p className="font-mono text-xs uppercase tracking-[0.25em] text-terracotta mb-1.5">
          {n} · {kicker}
        </p>
        <h2 id={`${id}-title`} className="text-lg font-semibold tracking-tight">
          {title}
        </h2>
      </header>
      <div className="px-5 md:px-7 py-6 space-y-5">{children}</div>
    </section>
  );
}

function RuleItem({ met, label, onFix }: { met: boolean; label: string; onFix: () => void }) {
  return (
    <li className="flex items-center gap-2.5 text-xs">
      <span
        aria-hidden
        className={`h-3 w-3 shrink-0 border flex items-center justify-center ${
          met ? "bg-trail border-trail" : "border-midnight/30 bg-white"
        }`}
      >
        {met && (
          <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="white" strokeWidth="1.5">
            <path d="M1 4.2 3.1 6.2 7 1.8" />
          </svg>
        )}
      </span>
      {met ? (
        <span className="text-midnight/70">{label}</span>
      ) : (
        <button
          type="button"
          onClick={onFix}
          className="text-midnight/80 underline underline-offset-2 decoration-stone hover:text-terracotta hover:decoration-terracotta transition-colors"
        >
          {label}
        </button>
      )}
      <span className="sr-only">{met ? "(done)" : "(missing)"}</span>
    </li>
  );
}

function MoneyInput({
  id,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative">
      <span
        aria-hidden
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-sm text-midnight/45"
      >
        $
      </span>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        min={0}
        max={1000}
        step="0.01"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`${inputCls} pl-7 pr-14 font-mono tabular-nums`}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[10px] uppercase tracking-[0.2em] text-dust"
      >
        AUD
      </span>
    </div>
  );
}

function Glance({
  draft,
  heatsSummary,
  timeText,
  feeText,
}: {
  draft: Draft;
  heatsSummary: string | null;
  timeText: string;
  feeText: string;
}) {
  const parts = dateParts(draft.dateTbc ? null : draft.date);
  const prizeCount = draft.prizes.filter((p) => p.label.trim() && p.amount.trim()).length;
  return (
    <div className="bg-midnight text-white">
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-white/10">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-stone/70 truncate">
          {draft.distance.trim() || "Distance"} · {draft.location.trim() || "Location TBC"}
        </p>
        <span
          className={`shrink-0 text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 ${
            statusChip[draft.status] ?? statusChip["Coming Soon"]
          }`}
        >
          {draft.status}
        </span>
      </div>
      <div className="px-4 py-5 flex gap-4 items-start">
        <div className="shrink-0 w-14 text-center border-r border-white/10 pr-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-stone/50">{parts.weekday}</p>
          <p
            className={`font-mono font-semibold tracking-tight leading-none mt-1 ${
              parts.tbc ? "text-lg text-gold" : "text-3xl"
            }`}
          >
            {parts.day}
          </p>
          {parts.month && (
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-stone/50 mt-1">
              {parts.month}
            </p>
          )}
        </div>
        <div className="min-w-0">
          <p className="font-semibold tracking-tight leading-snug break-words">
            {draft.name.trim() || "Untitled event"}
          </p>
          <p className="text-xs text-stone/60 mt-1 truncate">{draft.venue.trim() || "Venue TBC"}</p>
          <p className="font-mono text-xs text-stone/80 mt-2 tabular-nums">{timeText}</p>
        </div>
      </div>
      <dl className="border-t border-white/10 px-4 py-3.5 grid grid-cols-2 gap-y-2.5 text-xs">
        <dt className="text-stone/50">Booking</dt>
        <dd className="text-right font-mono tabular-nums">{heatsSummary ?? "No heats"}</dd>
        <dt className="text-stone/50">Entry</dt>
        <dd className="text-right font-mono tabular-nums">{feeText}</dd>
        <dt className="text-stone/50">Prizes</dt>
        <dd className="text-right font-mono tabular-nums">
          {prizeCount ? `${prizeCount} ${prizeCount === 1 ? "place" : "places"}` : "None"}
        </dd>
      </dl>
    </div>
  );
}
