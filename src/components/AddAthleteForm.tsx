"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import CountrySelect from "@/components/CountrySelect";
import { CategoryChoice } from "@/components/WalkUpForm";
import type { RaceCategory } from "@/lib/categories";

interface Fields {
  firstName: string;
  lastName: string;
  raceCategory: RaceCategory | null;
  email: string;
  dateOfBirth: string;
  city: string;
  country: string;
}

const EMPTY: Fields = {
  firstName: "",
  lastName: "",
  raceCategory: null,
  email: "",
  dateOfBirth: "",
  city: "",
  country: "",
};

const inputCls =
  "w-full border border-stone/40 px-3 py-2.5 text-sm bg-bone/50 focus:outline-none focus:border-terracotta transition-colors";
const labelCls = "block text-xs text-dust mb-1";

/**
 * Create an athlete on someone's behalf, for walk-ups and phone bookings.
 * When they later sign in with the same email, the account is theirs.
 */
export default function AddAthleteForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Fields>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [existingId, setExistingId] = useState<string | null>(null);
  const [created, setCreated] = useState<{ id: string; name: string } | null>(null);

  function set<K extends keyof Fields>(key: K, value: Fields[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setExistingId(null);
    setCreated(null);

    if (!form.firstName.trim() || !form.lastName.trim()) {
      return setError("First and last name are required.");
    }
    if (!form.raceCategory) {
      return setError("Pick Women or Men.");
    }
    if (!form.email.trim()) {
      return setError("An email is needed so they can claim the account.");
    }

    setBusy(true);
    try {
      const res = await fetch("/api/admin/athletes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = (await res.json()) as {
        success?: boolean;
        userId?: string;
        name?: string;
        error?: string;
        code?: string;
      };
      if (data.success && data.userId) {
        setCreated({ id: data.userId, name: data.name ?? `${form.firstName} ${form.lastName}` });
        setForm(EMPTY);
        router.refresh();
        return;
      }
      if (data.code === "EXISTS" && data.userId) setExistingId(data.userId);
      setError(data.error || "Could not add the athlete");
    } catch {
      setError("Could not connect. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-white border border-stone/40">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="add-athlete-panel"
        className="w-full flex items-center justify-between gap-4 px-5 py-4 min-h-[56px] text-left hover:bg-bone/60 transition-colors"
      >
        <span>
          <span className="block t-headline text-[1.4rem] md:text-[1.6rem]">Add an athlete</span>
          <span className="block mt-1 text-sm text-midnight/55">For walk-ups and phone bookings</span>
        </span>
        <span
          aria-hidden
          className={`shrink-0 w-8 h-8 flex items-center justify-center border border-stone/50 text-midnight/60 text-lg leading-none transition-transform duration-300 ${
            open ? "rotate-45" : ""
          }`}
        >
          +
        </span>
      </button>

      <div aria-live="polite">
        {created && (
          <div className="mx-5 mb-4 border border-trail/30 bg-trail/10 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-trail">
              {created.name} is in. Add their entry from the event page.
            </p>
            <Link
              href={`/admin/athletes/${created.id}`}
              className="link-quiet text-sm text-trail"
            >
              Open their profile
            </Link>
          </div>
        )}
      </div>

      <form
        id="add-athlete-panel"
        hidden={!open}
        onSubmit={handleSubmit}
        className="border-t border-stone/30 px-5 py-5 space-y-4 motion-safe:animate-fade-up"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="n-first" className={labelCls}>First name</label>
            <input
              id="n-first"
              autoComplete="off"
              maxLength={60}
              value={form.firstName}
              onChange={(e) => set("firstName", e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label htmlFor="n-last" className={labelCls}>Last name</label>
            <input
              id="n-last"
              autoComplete="off"
              maxLength={60}
              value={form.lastName}
              onChange={(e) => set("lastName", e.target.value)}
              className={inputCls}
            />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <CategoryChoice
            name="n-category"
            value={form.raceCategory}
            onChange={(value) => set("raceCategory", value)}
            labelClassName={labelCls}
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="n-email" className={labelCls}>Email</label>
            <input
              id="n-email"
              type="email"
              inputMode="email"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              placeholder="they@example.com"
              className={inputCls}
            />
          </div>
          <div>
            <label htmlFor="n-dob" className={labelCls}>
              Date of birth <span className="text-midnight/40">(sets age group)</span>
            </label>
            <input
              id="n-dob"
              type="date"
              max={new Date().toISOString().slice(0, 10)}
              value={form.dateOfBirth}
              onChange={(e) => set("dateOfBirth", e.target.value)}
              className={inputCls}
            />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="n-city" className={labelCls}>Town or city</label>
            <input
              id="n-city"
              autoComplete="off"
              maxLength={60}
              value={form.city}
              onChange={(e) => set("city", e.target.value)}
              placeholder="e.g. Geelong"
              className={inputCls}
            />
          </div>
          <div>
            <label htmlFor="n-country" className={labelCls}>Country</label>
            <CountrySelect
              id="n-country"
              value={form.country}
              onChange={(value) => set("country", value)}
              className={`${inputCls} cursor-pointer [&_option]:text-midnight ${form.country ? "" : "text-midnight/50"}`}
            />
          </div>
        </div>
        <p className="text-[11px] text-midnight/45 leading-relaxed">
          Fill in the date of birth, town and country and their profile is
          complete straight away. Leave any out and they finish it the first
          time they sign in.
        </p>

        {error && (
          <div role="alert" className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <p className="text-sm text-terracotta">{error}</p>
            {existingId && (
              <Link
                href={`/admin/athletes/${existingId}`}
                className="link-quiet text-sm text-midnight hover:text-terracotta transition-colors"
              >
                Go to their profile
              </Link>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={busy}
            className="btn btn-ink"
          >
            {busy ? "Adding..." : "Add athlete"}
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setError("");
              setExistingId(null);
            }}
            className="link-quiet text-sm text-midnight/60 hover:text-midnight px-3 py-2.5 min-h-[44px] transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
