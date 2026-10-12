"use client";

import { useState } from "react";
import CountrySelect from "@/components/CountrySelect";
import { formatEventDate } from "@/lib/dates";
import { formatFee } from "@/lib/money";

interface Initial {
  firstName: string;
  middleName: string;
  lastName: string;
  dateOfBirth: string;
  city: string;
  country: string;
  bio: string;
}

interface OpenEvent {
  id: string;
  slug: string;
  name: string;
  distance: string;
  date: string;
  time: string;
  venue: string;
  entryFeeCents: number;
  hasHeats: boolean;
  /** "12 heats · 5:00pm to 7:45pm", shown in place of the start time. */
  heatSummary: string | null;
}

const inputCls =
  "w-full bg-white/5 border border-white/15 px-4 py-3.5 text-base text-white placeholder:text-white/30 focus:outline-none focus:border-terracotta focus:bg-white/10 transition-colors";
const selectCls =
  "w-full appearance-none bg-white/5 border border-white/15 pl-4 pr-10 py-3.5 text-base cursor-pointer focus:outline-none focus:border-terracotta focus:bg-white/10 transition-colors [color-scheme:dark] [&_optgroup]:bg-midnight [&_option]:bg-midnight [&_option]:text-white";
const labelCls =
  "block font-mono text-[10px] uppercase tracking-[0.25em] text-stone/60 mb-2";

/**
 * First-run profile, in three short steps, then an invitation to the next
 * open event. Nothing else on the site opens until this is done. When the
 * athlete arrived mid-booking (`next`), they go straight back to it instead.
 */
export default function Onboarding({
  initial,
  openEvent,
  next = null,
}: {
  initial: Initial;
  openEvent: OpenEvent | null;
  next?: string | null;
}) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<Initial>(initial);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Someone part way through booking a heat skips the event offer.
  const offer = next ? null : openEvent;
  // Exactly /events/<slug>/book. A /booked link means the heat is already theirs.
  const toBooking = !!next && /\/events\/[^/]+\/book(\?|$)/.test(next);
  const toBooked = !!next && /\/events\/[^/]+\/booked(\?|$)/.test(next);
  const totalSteps = offer ? 4 : 3;

  function set<K extends keyof Initial>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function goNext() {
    setError("");
    if (step === 0) {
      if (!form.firstName.trim()) return setError("Your first name, please.");
      if (!form.lastName.trim()) return setError("And your last name.");
    }
    if (step === 1) {
      if (!form.dateOfBirth) return setError("Your date of birth sets your age group.");
      if (!form.city.trim()) return setError("Which town or city are you based in?");
      if (!form.country) return setError("Pick your country from the list.");
    }
    setStep((s) => s + 1);
  }

  async function submitProfile() {
    setError("");
    if (form.bio.trim().length < 10) {
      return setError("A sentence or two is all it takes.");
    }
    setBusy(true);
    let leaving = false;
    try {
      const res = await fetch("/api/profile/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: form.firstName,
          middleName: form.middleName,
          lastName: form.lastName,
          dateOfBirth: form.dateOfBirth,
          city: form.city,
          country: form.country,
          bio: form.bio,
        }),
      });
      const data = (await res.json()) as { success?: boolean; error?: string };
      if (!data.success) {
        setError(data.error || "Something went wrong");
        return;
      }
      if (offer) {
        setStep(3);
      } else {
        leaving = true;
        window.location.href = next ?? "/dashboard?welcome=1";
      }
    } catch {
      setError("Could not connect. Try again.");
    } finally {
      if (!leaving) setBusy(false);
    }
  }

  async function enterEvent() {
    if (!offer) return;
    setBusy(true);
    setError("");
    let leaving = false;
    try {
      const res = await fetch("/api/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: offer.id }),
      });
      const data = (await res.json()) as {
        success?: boolean;
        checkoutUrl?: string;
        next?: string;
        error?: string;
      };
      if (data.checkoutUrl || data.success) {
        leaving = true;
        window.location.href =
          data.checkoutUrl || data.next || `/dashboard?entered=${offer.id}`;
        return;
      }
      setError(data.error || "Could not enter the event");
    } catch {
      setError("Could not connect. Try again.");
    } finally {
      if (!leaving) setBusy(false);
    }
  }

  const headings = [
    { kicker: "Step 1 of " + totalSteps, title: "What do we call you?" },
    { kicker: "Step 2 of " + totalSteps, title: "A couple of details" },
    { kicker: "Step 3 of " + totalSteps, title: "In your words" },
    { kicker: "One more thing", title: "There is a race open" },
  ];

  return (
    <div className="bg-midnight/80 backdrop-blur-md border border-white/10 p-7 md:p-10 shadow-2xl shadow-black/40 motion-safe:animate-fade-up">
      {/* Progress */}
      <div className="flex gap-1.5 mb-8" aria-hidden>
        {Array.from({ length: totalSteps }).map((_, i) => (
          <div
            key={i}
            className={`h-0.5 flex-1 transition-colors duration-500 ${
              i <= step ? "bg-terracotta" : "bg-white/15"
            }`}
          />
        ))}
      </div>

      <p className="font-mono text-xs uppercase tracking-[0.25em] text-terracotta mb-3">
        {headings[step].kicker}
      </p>
      <h1 className="text-3xl md:text-4xl font-semibold tracking-tight mb-2">
        {headings[step].title}
      </h1>

      {step === 0 && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            goNext();
          }}
          className="mt-6 space-y-5"
        >
          <p className="text-sm text-stone/60 leading-relaxed">
            This is how your name appears on results and your athlete page.
            {toBooking && " Three quick steps, then you pick your heat."}
            {toBooked && " Three quick steps, then straight to your booking."}
          </p>
          <div>
            <label htmlFor="firstName" className={labelCls}>
              First name
            </label>
            <input
              id="firstName"
              autoFocus
              autoComplete="given-name"
              value={form.firstName}
              onChange={(e) => set("firstName", e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label htmlFor="middleName" className={labelCls}>
              Middle name <span className="text-stone/40">(if you have one)</span>
            </label>
            <input
              id="middleName"
              autoComplete="additional-name"
              value={form.middleName}
              onChange={(e) => set("middleName", e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label htmlFor="lastName" className={labelCls}>
              Last name
            </label>
            <input
              id="lastName"
              autoComplete="family-name"
              value={form.lastName}
              onChange={(e) => set("lastName", e.target.value)}
              className={inputCls}
            />
          </div>
          {error && <p role="alert" className="text-sm text-terracotta">{error}</p>}
          <button type="submit" className="w-full bg-terracotta text-white font-medium py-4 hover:bg-terracotta/90 transition-colors">
            Continue
          </button>
        </form>
      )}

      {step === 1 && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            goNext();
          }}
          className="mt-6 space-y-5"
        >
          <p className="text-sm text-stone/60 leading-relaxed">
            Your date of birth places you in an age group at every event.
            Only your age group is ever shown, never the date.
          </p>
          <div>
            <label htmlFor="dob" className={labelCls}>
              Date of birth
            </label>
            <input
              id="dob"
              type="date"
              autoFocus
              autoComplete="bday"
              max={new Date().toISOString().slice(0, 10)}
              value={form.dateOfBirth}
              onChange={(e) => set("dateOfBirth", e.target.value)}
              className={`${inputCls} [color-scheme:dark]`}
            />
          </div>
          <div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label htmlFor="city" className={labelCls}>
                  Town or city
                </label>
                <input
                  id="city"
                  placeholder="e.g. Geelong"
                  autoComplete="address-level2"
                  maxLength={60}
                  value={form.city}
                  onChange={(e) => set("city", e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label htmlFor="country" className={labelCls}>
                  Country
                </label>
                <div className="relative">
                  <CountrySelect
                    id="country"
                    value={form.country}
                    onChange={(value) => set("country", value)}
                    className={`${selectCls} ${form.country ? "text-white" : "text-white/40"}`}
                  />
                  <svg
                    aria-hidden
                    width="12"
                    height="12"
                    viewBox="0 0 12 12"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-stone/60"
                  >
                    <path d="M2.5 4.5L6 8l3.5-3.5" />
                  </svg>
                </div>
              </div>
            </div>
            <p className="mt-2 text-[11px] text-stone/40">
              Shown on your athlete page as your home base.
            </p>
          </div>
          {error && <p role="alert" className="text-sm text-terracotta">{error}</p>}
          <div className="flex gap-3">
            <button type="button" onClick={() => setStep(0)} className="px-5 py-4 text-sm text-stone/60 hover:text-white transition-colors">
              Back
            </button>
            <button type="submit" className="flex-1 bg-terracotta text-white font-medium py-4 hover:bg-terracotta/90 transition-colors">
              Continue
            </button>
          </div>
        </form>
      )}

      {step === 2 && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submitProfile();
          }}
          className="mt-6 space-y-5"
        >
          <p className="text-sm text-stone/60 leading-relaxed">
            Who you are, what you are chasing. This sits under your name on
            your public athlete page. You can add a longer story later.
          </p>
          <div>
            <label htmlFor="bio" className={labelCls}>
              About you
            </label>
            <textarea
              id="bio"
              autoFocus
              rows={5}
              maxLength={600}
              value={form.bio}
              onChange={(e) => set("bio", e.target.value)}
              placeholder="Chasing a sub 5 mile. Train with the Geelong crew on Tuesdays."
              className={inputCls}
            />
            <p className="mt-1.5 text-[11px] text-stone/40 text-right">
              {form.bio.length} / 600
            </p>
          </div>
          {error && <p role="alert" className="text-sm text-terracotta">{error}</p>}
          <div className="flex gap-3">
            <button type="button" onClick={() => setStep(1)} className="px-5 py-4 text-sm text-stone/60 hover:text-white transition-colors">
              Back
            </button>
            <button type="submit" disabled={busy} className="flex-1 bg-terracotta text-white font-medium py-4 hover:bg-terracotta/90 transition-colors disabled:opacity-50">
              {busy
                ? "Saving..."
                : toBooking
                  ? "Save and pick your heat"
                  : toBooked
                    ? "Save and see your booking"
                    : next || offer
                      ? "Save and continue"
                      : "Finish"}
            </button>
          </div>
        </form>
      )}

      {step === 3 && offer && (
        <div className="mt-6">
          <p className="text-sm text-stone/60 leading-relaxed mb-6">
            {offer.hasHeats
              ? "Your profile is set. Heats are open for booking right now."
              : "Your profile is set. Entries are open right now for this one."}
          </p>
          <div className="border border-terracotta/40 bg-terracotta/10 p-6 mb-6">
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-terracotta mb-2">
              {offer.distance} · {offer.venue}
            </p>
            <p className="text-2xl font-semibold tracking-tight">{offer.name}</p>
            <p className="text-sm text-stone/70 mt-1">
              {formatEventDate(offer.date, "medium")} ·{" "}
              {offer.heatSummary ?? offer.time}
            </p>
            <p className="font-mono text-xs text-stone/60 mt-4">
              {offer.entryFeeCents > 0
                ? `${formatFee(offer.entryFeeCents)} entry`
                : "Free entry"}
            </p>
          </div>
          {error && <p role="alert" className="text-sm text-terracotta mb-4">{error}</p>}
          {offer.hasHeats ? (
            <a
              href={`/events/${offer.slug}/book`}
              className="block w-full text-center bg-terracotta text-white text-lg font-medium py-4 hover:bg-terracotta/90 transition-colors"
            >
              Choose your heat
            </a>
          ) : (
            <button
              onClick={enterEvent}
              disabled={busy}
              className="w-full bg-terracotta text-white text-lg font-medium py-4 hover:bg-terracotta/90 transition-colors disabled:opacity-50"
            >
              {busy ? "Entering..." : "Count me in"}
            </button>
          )}
          <a
            href="/dashboard?welcome=1"
            className="mt-4 w-full min-h-11 inline-flex items-center justify-center py-2 text-sm text-stone/50 hover:text-white transition-colors"
          >
            Not this time
          </a>
        </div>
      )}
    </div>
  );
}
