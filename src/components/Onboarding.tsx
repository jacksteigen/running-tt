"use client";

import { useRef, useState, type ReactNode } from "react";
import CountrySelect from "@/components/CountrySelect";
import { CategoryChoice } from "@/components/CategoryPrompt";
import { toRaceCategory, type RaceCategory } from "@/lib/categories";
import { formatEventDate } from "@/lib/dates";
import { formatFee } from "@/lib/money";
import { fieldInputCls, fieldLabelCls, fieldSelectCls, fieldTextareaCls } from "@/components/fieldStyles";

interface Initial {
  firstName: string;
  middleName: string;
  lastName: string;
  dateOfBirth: string;
  city: string;
  country: string;
  bio: string;
  /** Already set when an admin added them at the track. */
  raceCategory?: string | null;
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

/* Paper fields on bone, matching sign in. The focus frame tightens the
   global focus outline onto the border: one clear 2px terracotta edge. */
const inputCls = fieldInputCls;
const textareaCls = fieldTextareaCls;
const selectCls = fieldSelectCls;
const labelCls = fieldLabelCls;
const helpCls = "text-[0.98rem] text-midnight/65 leading-relaxed";
const CATEGORY_ERROR = "Pick the category you race in.";

/** What kind of backing an athlete is after. Saved as a short list. */
const SUPPORT_OPTIONS = [
  "Shoes",
  "Race kit",
  "Nutrition",
  "Travel and race costs",
  "Cash support",
  "Coaching",
];

/**
 * First-run profile, in four short steps, then an invitation to the next
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
  const [raceCategory, setRaceCategory] = useState<RaceCategory | null>(
    toRaceCategory(initial.raceCategory)
  );
  const categoryInput = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [dreamBrands, setDreamBrands] = useState("");
  const [support, setSupport] = useState<string[]>([]);
  const [notSeeking, setNotSeeking] = useState(false);

  // Someone part way through booking a heat skips the event offer.
  const offer = next ? null : openEvent;
  // Exactly /events/<slug>/book. A /booked link means the heat is already theirs.
  const toBooking = !!next && /\/events\/[^/]+\/book(\?|$)/.test(next);
  const toBooked = !!next && /\/events\/[^/]+\/booked(\?|$)/.test(next);
  const totalSteps = offer ? 5 : 4;

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
      if (!raceCategory) {
        categoryInput.current?.focus();
        return setError(CATEGORY_ERROR);
      }
      if (!form.city.trim()) return setError("Which town or city are you based in?");
      if (!form.country) return setError("Pick your country from the list.");
    }
    setStep((s) => s + 1);
  }

  function bioNext() {
    setError("");
    if (form.bio.trim().length < 10) {
      return setError("A sentence or two is all it takes.");
    }
    setStep(3);
  }

  function toggleSupport(option: string) {
    setSupport((prev) =>
      prev.includes(option) ? prev.filter((o) => o !== option) : [...prev, option]
    );
  }

  async function submitProfile() {
    setError("");
    if (!notSeeking && dreamBrands.trim().length < 2) {
      return setError("Name a brand or two, or tick that you are not after a sponsor.");
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
          raceCategory,
          city: form.city,
          country: form.country,
          bio: form.bio,
          dreamBrands: notSeeking ? "" : dreamBrands,
          sponsorInterests: notSeeking ? "" : support.join(", "),
          notSeekingSponsor: notSeeking,
        }),
      });
      const data = (await res.json()) as { success?: boolean; error?: string };
      if (!data.success) {
        setError(data.error || "Something went wrong");
        return;
      }
      if (offer) {
        setStep(4);
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

  const headings: { kicker: string; title: ReactNode }[] = [
    {
      kicker: "Step 1 of " + totalSteps,
      title: (
        <>
          What do we <em>call you?</em>
        </>
      ),
    },
    {
      kicker: "Step 2 of " + totalSteps,
      title: (
        <>
          A couple of <em>details.</em>
        </>
      ),
    },
    {
      kicker: "Step 3 of " + totalSteps,
      title: (
        <>
          In your <em>own words.</em>
        </>
      ),
    },
    {
      kicker: "Step 4 of " + totalSteps,
      title: (
        <>
          Brands you would <em>love to run for.</em>
        </>
      ),
    },
    {
      kicker: "One more thing",
      title: (
        <>
          There is a race <em>open.</em>
        </>
      ),
    },
  ];

  return (
    <div className="motion-safe:animate-fade-up">
      {/* Progress, a run of hairline splits */}
      <div className="flex gap-1.5 mb-9" aria-hidden>
        {Array.from({ length: totalSteps }).map((_, i) => (
          <div
            key={i}
            className={`h-0.5 flex-1 transition-colors duration-500 ${
              i <= step ? "bg-terracotta" : "bg-midnight/12"
            }`}
          />
        ))}
      </div>

      <p className="t-eyebrow text-terracotta">{headings[step].kicker}</p>
      <h1 className="t-display mt-4 text-[2.5rem] md:text-[3.1rem]">
        {headings[step].title}
      </h1>

      {step === 0 && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            goNext();
          }}
          className="mt-6 space-y-6"
        >
          <p className={helpCls}>
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
              Middle name{" "}
              <span className="t-caption normal-case tracking-normal font-normal text-midnight/45">
                if you have one
              </span>
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
          {error && <p role="alert" className="text-[0.95rem] text-terracotta">{error}</p>}
          <button type="submit" className="btn btn-primary btn-lg w-full">
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
          className="mt-6 space-y-6"
        >
          <p className={helpCls}>
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
              className={inputCls}
            />
          </div>
          <fieldset>
            <legend className={labelCls}>Which category do you race in?</legend>
            <CategoryChoice
              name="raceCategory"
              value={raceCategory}
              onChange={(category) => {
                setRaceCategory(category);
                if (error === CATEGORY_ERROR) setError("");
              }}
              describedBy="raceCategory-help"
              inputRef={categoryInput}
            />
            <p id="raceCategory-help" className="t-caption mt-2.5 text-midnight/50">
              Races that pay prize money in women&apos;s and men&apos;s categories use this
              for prize places and age groups.
            </p>
          </fieldset>
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
                    className={`${selectCls} ${form.country ? "text-midnight" : "text-midnight/40"}`}
                  />
                  <svg
                    aria-hidden
                    width="12"
                    height="12"
                    viewBox="0 0 12 12"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-midnight/50"
                  >
                    <path d="M2.5 4.5L6 8l3.5-3.5" />
                  </svg>
                </div>
              </div>
            </div>
            <p className="t-caption mt-2.5 text-midnight/50">
              Shown on your athlete page as your home base.
            </p>
          </div>
          {error && <p role="alert" className="text-[0.95rem] text-terracotta">{error}</p>}
          <div className="flex items-center gap-6">
            <button
              type="button"
              onClick={() => setStep(0)}
              className="inline-flex items-center min-h-14 link-quiet text-[0.95rem] text-midnight/65 hover:text-midnight transition-colors"
            >
              Back
            </button>
            <button type="submit" className="btn btn-primary btn-lg flex-1">
              Continue
            </button>
          </div>
        </form>
      )}

      {step === 2 && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            bioNext();
          }}
          className="mt-6 space-y-6"
        >
          <p className={helpCls}>
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
              className={textareaCls}
            />
            <p className="t-numeral mt-2 text-[0.85rem] text-midnight/40 text-right">
              {form.bio.length} / 600
            </p>
          </div>
          {error && <p role="alert" className="text-[0.95rem] text-terracotta">{error}</p>}
          <div className="flex items-center gap-6">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="inline-flex items-center min-h-14 link-quiet text-[0.95rem] text-midnight/65 hover:text-midnight transition-colors"
            >
              Back
            </button>
            <button type="submit" className="btn btn-primary btn-lg flex-1">
              Continue
            </button>
          </div>
        </form>
      )}

      {step === 3 && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submitProfile();
          }}
          className="mt-6 space-y-7"
        >
          <p className={helpCls}>
            Running TT works with brands to back runners. Tell us who you would
            love to be supported by, and we will reach out to them for you.
            This stays between you and us.
          </p>
          <div>
            <label htmlFor="dreamBrands" className={labelCls}>
              Your dream brands
            </label>
            <input
              id="dreamBrands"
              autoFocus
              value={dreamBrands}
              onChange={(e) => setDreamBrands(e.target.value)}
              disabled={notSeeking}
              maxLength={300}
              placeholder="e.g. Steigen, Nike, Maurten"
              className={`${inputCls} disabled:opacity-50`}
            />
            <p className="mt-2 text-[0.88rem] text-midnight/50">Separate a few with commas.</p>
          </div>
          <fieldset disabled={notSeeking} className="disabled:opacity-50">
            <legend className={labelCls}>What would help you most</legend>
            <div className="flex flex-wrap gap-2">
              {SUPPORT_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={support.includes(option)}
                  onClick={() => toggleSupport(option)}
                  className={`btn btn-sm normal-case tracking-normal ${
                    support.includes(option) ? "btn-ink" : "btn-ghost"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </fieldset>
          <label className="flex items-start gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={notSeeking}
              onChange={(e) => setNotSeeking(e.target.checked)}
              className="mt-1 h-5 w-5 shrink-0 accent-[#C4593A]"
            />
            <span className="text-[0.98rem] text-midnight/75 leading-relaxed">
              I am not after a sponsor right now
            </span>
          </label>
          {error && <p role="alert" className="text-[0.95rem] text-terracotta">{error}</p>}
          <div className="flex items-center gap-6">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="inline-flex items-center min-h-14 link-quiet text-[0.95rem] text-midnight/65 hover:text-midnight transition-colors"
            >
              Back
            </button>
            <button type="submit" disabled={busy} className="btn btn-primary btn-lg flex-1">
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

      {step === 4 && offer && (
        <div className="mt-6">
          <p className={`${helpCls} mb-8`}>
            {offer.hasHeats
              ? "Your profile is set. Heats are open for booking right now."
              : "Your profile is set. Entries are open right now for this one."}
          </p>
          {/* The race, set like a ticket */}
          <div className="bg-midnight text-bone px-6 py-7 md:px-8 mb-6">
            <p className="t-eyebrow text-terracotta">
              {offer.distance} · {offer.venue}
            </p>
            <p className="t-headline mt-3 text-[1.9rem] md:text-[2.3rem]">{offer.name}</p>
            <p className="mt-3 text-[0.95rem] text-bone/70 leading-relaxed">
              {formatEventDate(offer.date, "medium")} ·{" "}
              {offer.heatSummary ?? offer.time}
            </p>
            <p className="mt-6 pt-5 border-t rule-light flex items-baseline gap-2">
              {offer.entryFeeCents > 0 ? (
                <>
                  <span className="t-numeral text-[1.7rem]">{formatFee(offer.entryFeeCents)}</span>
                  <span className="text-[0.95rem] text-bone/65">entry</span>
                </>
              ) : (
                <span className="t-headline text-[1.4rem]">Free entry</span>
              )}
            </p>
          </div>
          {error && <p role="alert" className="text-[0.95rem] text-terracotta mb-4">{error}</p>}
          {offer.hasHeats ? (
            <a href={`/events/${offer.slug}/book`} className="btn btn-primary btn-lg w-full">
              Choose your heat
            </a>
          ) : (
            <button onClick={enterEvent} disabled={busy} className="btn btn-primary btn-lg w-full">
              {busy ? "Entering..." : "Count me in"}
            </button>
          )}
          <div className="mt-3 text-center">
            <a
              href="/dashboard?welcome=1"
              className="inline-flex items-center min-h-11 px-2 link-quiet text-[0.95rem] text-midnight/60"
            >
              Not this time
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
