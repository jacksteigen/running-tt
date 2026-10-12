"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { HeatAvailability } from "@/lib/heats";
import CountrySelect from "@/components/CountrySelect";

/* Small pieces shared by the admin event screen: heat names, a heat picker
   that shows space left, and the "that heat is full, are you sure?" round
   trip. They live here because this is the leaf the others already import. */

export type HeatOption = Pick<
  HeatAvailability,
  "number" | "offsetMinutes" | "label" | "startTime" | "capacity" | "booked" | "remaining" | "full"
>;

/** "Heat 4 · 5:45pm", or "Heat 4" while the first heat time is not set. */
export function heatName(heats: HeatOption[], n: number | null | undefined): string {
  if (!n) return "No heat";
  const heat = heats.find((h) => h.number === n);
  return heat?.startTime ? `Heat ${n} · ${heat.label}` : `Heat ${n}`;
}

/** The first heat with a spot left, skipping one (usually their current heat). */
export function firstOpenHeat(heats: HeatOption[], skip?: number | null): number | null {
  return heats.find((h) => !h.full && h.number !== skip)?.number ?? null;
}

interface ApiReply {
  success?: boolean;
  error?: string;
  code?: string;
}

/**
 * Send an admin write that respects heat capacity. A full heat comes back as
 * HEAT_FULL; ask once, and only send it again with force on a clear yes.
 * Returns "cancelled" when the admin backs out.
 */
export async function sendWithHeatCheck<T extends ApiReply>(
  url: string,
  method: "POST" | "PATCH",
  body: Record<string, unknown>,
  verb: "Add" | "Move"
): Promise<T | "cancelled"> {
  let force = false;
  for (;;) {
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(force ? { ...body, force: true } : body),
    });
    const data = (await res.json()) as T;
    if (!force && res.status === 409 && data.code === "HEAT_FULL") {
      if (!window.confirm(`Heat ${body.heatNumber} is full. ${verb} anyway?`)) {
        return "cancelled";
      }
      force = true;
      continue;
    }
    return data;
  }
}

/** Heat picker that shows how much room each heat has. */
export function HeatSelect({
  id,
  heats,
  value,
  onChange,
  current,
  compact = false,
  placeholder,
  ariaLabel,
  className = "",
}: {
  id?: string;
  heats: HeatOption[];
  value: string;
  onChange: (value: string) => void;
  /** Their heat now; shown but not selectable. */
  current?: number | null;
  compact?: boolean;
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={ariaLabel}
      className={className}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {heats.map((h) => {
        const name = compact
          ? `H${h.number}${h.startTime ? ` · ${h.label}` : ""}`
          : `Heat ${h.number} · ${h.label}`;
        const room =
          h.number === current ? "current" : h.full ? "full" : `${h.remaining} left`;
        return (
          <option key={h.number} value={h.number} disabled={h.number === current && value !== String(h.number)}>
            {name} · {room}
          </option>
        );
      })}
    </select>
  );
}

const inputCls =
  "w-full h-11 border border-stone/40 px-3 text-base sm:text-sm bg-bone/50 focus:outline-none focus:border-terracotta transition-colors";
const labelCls = "block font-mono text-[10px] uppercase tracking-[0.2em] text-dust mb-1.5";

interface Fields {
  firstName: string;
  lastName: string;
  email: string;
  dateOfBirth: string;
  city: string;
  country: string;
}

const EMPTY: Fields = {
  firstName: "",
  lastName: "",
  email: "",
  dateOfBirth: "",
  city: "",
  country: "Australia",
};

/**
 * Race-day sign-up for someone without an account. Creates the athlete, then
 * the entry, so they show up on the start list and in results straight away.
 * If they sign in later with the same email, the account is theirs.
 */
export default function WalkUpForm({
  eventId,
  heats,
  enteredHeats,
}: {
  eventId: string;
  heats: HeatOption[];
  /** Athletes already holding a spot, and their heat, so we never move one by accident. */
  enteredHeats: Record<string, number | null>;
}) {
  const router = useRouter();
  const withHeats = heats.length > 0;
  const [form, setForm] = useState<Fields>(EMPTY);
  const [heat, setHeat] = useState(() => String(firstOpenHeat(heats) ?? ""));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  // Set when the athlete was created but the entry did not go through, so a
  // retry only needs to add the entry.
  const [created, setCreated] = useState<{ userId: string; name: string } | null>(null);
  const [existing, setExisting] = useState<{ userId: string; message: string } | null>(null);
  const firstRef = useRef<HTMLInputElement>(null);

  function set<K extends keyof Fields>(key: K, value: Fields[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSuccess("");
    if (key === "email") {
      setExisting(null);
      setCreated(null);
    }
  }

  async function enter(userId: string, name: string) {
    const heatNumber = withHeats ? Number(heat) : null;
    const data = await sendWithHeatCheck<ApiReply & { entryId?: string }>(
      "/api/admin/entries",
      "POST",
      { eventId, userId, heatNumber, notify: true },
      "Add"
    );
    if (data === "cancelled") {
      setError(`${name} is not on the start list yet. Pick a heat with space and add them again.`);
      return false;
    }
    if (!data.success) {
      setError(data.error || "Could not add them to the start list");
      return false;
    }
    setSuccess(
      `${name} is in${withHeats ? ` ${heatName(heats, heatNumber)}` : ""}. Their confirmation email is on its way.`
    );
    setForm(EMPTY);
    setCreated(null);
    setExisting(null);
    router.refresh();
    firstRef.current?.focus();
    return true;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (!form.firstName.trim() || !form.lastName.trim()) {
      return setError("First and last name, please.");
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      return setError("An email is needed so they can claim the account later.");
    }
    if (withHeats && !heat) return setError("Pick a heat.");

    setBusy(true);
    try {
      if (created) {
        await enter(created.userId, created.name);
        return;
      }
      const res = await fetch("/api/admin/athletes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          email: form.email.trim(),
          dateOfBirth: form.dateOfBirth || undefined,
          city: form.city.trim() || undefined,
          country: form.country || undefined,
        }),
      });
      const data = (await res.json()) as ApiReply & { userId?: string; name?: string };
      if (res.status === 409 && data.code === "EXISTS" && data.userId) {
        setExisting({ userId: data.userId, message: data.error || "That email already has an account" });
        return;
      }
      if (!data.success || !data.userId) {
        setError(data.error || "Could not create the athlete");
        return;
      }
      const name = data.name || `${form.firstName.trim()} ${form.lastName.trim()}`;
      setCreated({ userId: data.userId, name });
      await enter(data.userId, name);
    } catch {
      setError("Could not connect. Check the signal and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function addExisting() {
    if (!existing) return;
    setError("");
    setBusy(true);
    try {
      await enter(existing.userId, "Their existing account");
    } catch {
      setError("Could not connect. Check the signal and try again.");
    } finally {
      setBusy(false);
    }
  }

  const existingHeat =
    existing && existing.userId in enteredHeats ? enteredHeats[existing.userId] : undefined;

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label htmlFor="walkup-first" className={labelCls}>First name</label>
          <input
            id="walkup-first"
            ref={firstRef}
            value={form.firstName}
            onChange={(e) => set("firstName", e.target.value)}
            autoComplete="off"
            className={inputCls}
          />
        </div>
        <div>
          <label htmlFor="walkup-last" className={labelCls}>Last name</label>
          <input
            id="walkup-last"
            value={form.lastName}
            onChange={(e) => set("lastName", e.target.value)}
            autoComplete="off"
            className={inputCls}
          />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="walkup-email" className={labelCls}>Email</label>
          <input
            id="walkup-email"
            type="email"
            inputMode="email"
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            className={inputCls}
          />
        </div>
        <div>
          <label htmlFor="walkup-dob" className={labelCls}>
            Date of birth <span className="normal-case tracking-normal text-midnight/40">(optional, sets age group)</span>
          </label>
          <input
            id="walkup-dob"
            type="date"
            value={form.dateOfBirth}
            onChange={(e) => set("dateOfBirth", e.target.value)}
            className={inputCls}
          />
        </div>
        {withHeats && (
          <div>
            <label htmlFor="walkup-heat" className={labelCls}>Heat</label>
            <HeatSelect
              id="walkup-heat"
              heats={heats}
              value={heat}
              onChange={setHeat}
              placeholder="Pick a heat"
              className={inputCls}
            />
          </div>
        )}
        <div>
          <label htmlFor="walkup-city" className={labelCls}>Town or city</label>
          <input
            id="walkup-city"
            value={form.city}
            onChange={(e) => set("city", e.target.value)}
            autoComplete="off"
            className={inputCls}
          />
        </div>
        <div>
          <label htmlFor="walkup-country" className={labelCls}>Country</label>
          <CountrySelect
            id="walkup-country"
            value={form.country}
            onChange={(v) => set("country", v)}
            className={inputCls}
          />
        </div>
      </div>

      {existing && (
        <div role="alert" className="border border-gold/50 bg-gold/10 px-4 py-3 text-sm">
          <p>{existing.message}.</p>
          {existingHeat !== undefined ? (
            <p className="mt-1 text-midnight/60">
              They are already on the start list{existingHeat ? ` in ${heatName(heats, existingHeat)}` : ""}.
            </p>
          ) : (
            <button
              type="button"
              onClick={addExisting}
              disabled={busy}
              className="mt-3 h-11 px-4 text-sm font-medium bg-midnight text-white hover:bg-midnight/90 transition-colors disabled:opacity-50"
            >
              Add the existing account instead
            </button>
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-terracotta">
          {error}
        </p>
      )}
      <p aria-live="polite" className={success ? "text-sm text-trail font-medium" : "sr-only"}>
        {success}
      </p>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <button
          type="submit"
          disabled={busy}
          className="h-11 px-6 text-sm font-medium bg-terracotta text-white hover:bg-terracotta/90 transition-colors disabled:opacity-50"
        >
          {busy ? "Adding..." : created ? `Add ${created.name} to the start list` : "Create and add"}
        </button>
        <p className="text-xs text-midnight/50">
          No payment is taken here. They get a confirmation email.
        </p>
      </div>
    </form>
  );
}
