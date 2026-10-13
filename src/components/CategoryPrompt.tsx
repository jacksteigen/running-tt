"use client";

import { useState, useTransition, type ReactNode, type Ref } from "react";
import { useRouter } from "next/navigation";
import { CATEGORY_LABEL, RACE_CATEGORIES, type RaceCategory } from "@/lib/categories";

/**
 * Women or Men as two large radio tiles, for forms that save later
 * (onboarding, the profile editor). Native radios underneath, so arrow keys
 * and screen readers work as they do anywhere else. Wrap it in a fieldset
 * with a legend.
 */
export function CategoryChoice({
  name,
  value,
  onChange,
  describedBy,
  inputRef,
}: {
  name: string;
  value: RaceCategory | null;
  onChange: (category: RaceCategory) => void;
  /** Id of the helper text under the choices. */
  describedBy?: string;
  /** Lands on the first option, so a form can send focus here on an error. */
  inputRef?: Ref<HTMLInputElement>;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {RACE_CATEGORIES.map((category, i) => {
        const on = value === category;
        return (
          <label
            key={category}
            className={`flex h-14 cursor-pointer items-center gap-3 px-4 border transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-terracotta ${
              on
                ? "bg-terracotta/[0.05] border-terracotta ring-1 ring-inset ring-terracotta"
                : "bg-white/70 border-midnight/20 hover:border-midnight/40"
            }`}
          >
            <input
              ref={i === 0 ? inputRef : undefined}
              type="radio"
              name={name}
              value={category}
              checked={on}
              onChange={() => onChange(category)}
              aria-describedby={describedBy}
              className="sr-only"
            />
            <span
              aria-hidden
              className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                on ? "border-terracotta" : "border-midnight/35"
              }`}
            >
              {on && <span className="h-2 w-2 rounded-full bg-terracotta" />}
            </span>
            <span className="t-headline text-[1.3rem] text-midnight">{CATEGORY_LABEL[category]}</span>
          </label>
        );
      })}
    </div>
  );
}

/**
 * Asks a signed-in athlete which category they race in, and saves it the
 * moment they answer. Used where the question stands in the way of
 * something else: the dashboard, and booking a race paid by category.
 */
export default function CategoryPrompt({
  tone = "light",
  heading,
  body,
  stacked = false,
}: {
  /** "dark" when it sits on midnight. */
  tone?: "light" | "dark";
  heading?: ReactNode;
  body?: string;
  /** Question above the buttons at every width, for a narrow column. */
  stacked?: boolean;
}) {
  const router = useRouter();
  const dark = tone === "dark";
  const [saving, setSaving] = useState<RaceCategory | null>(null);
  const [error, setError] = useState("");
  const [refreshing, startRefresh] = useTransition();

  async function pick(category: RaceCategory) {
    if (saving || refreshing) return;
    setSaving(category);
    setError("");
    try {
      const res = await fetch("/api/profile/category", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raceCategory: category }),
      });
      const data = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };
      if (!res.ok || !data.success) {
        setError(data.error || "That did not save. Try again.");
        setSaving(null);
        return;
      }
      // The page redraws without this prompt once the server has the answer.
      startRefresh(() => {
        router.refresh();
        setSaving(null);
      });
    } catch {
      setError("Could not connect. Check your signal and try again.");
      setSaving(null);
    }
  }

  const busy = saving !== null || refreshing;

  return (
    <div
      className={
        stacked
          ? "flex flex-col gap-5"
          : "flex flex-col md:flex-row md:items-center md:justify-between gap-5 md:gap-10"
      }
    >
      <div className="max-w-2xl">
        {heading && (
          <h2 className={`t-headline text-[1.5rem] md:text-[1.8rem] ${dark ? "text-bone" : "text-midnight"}`}>
            {heading}
          </h2>
        )}
        {body && (
          <p className={`mt-2 leading-relaxed ${dark ? "text-bone/70" : "text-midnight/70"}`}>{body}</p>
        )}
      </div>
      <div className="shrink-0">
        <div role="group" aria-label="The category you race in" className="grid grid-cols-2 gap-3">
          {RACE_CATEGORIES.map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => pick(category)}
              disabled={busy}
              aria-busy={saving === category || undefined}
              className={`btn md:min-w-[9rem] ${dark ? "btn-light" : "btn-ink"}`}
              // Working, not unavailable: the chosen one stays near full strength.
              style={saving === category ? { opacity: 0.85, cursor: "wait" } : undefined}
            >
              {saving === category ? "Saving..." : CATEGORY_LABEL[category]}
            </button>
          ))}
        </div>
        <p
          aria-live="polite"
          className={
            error
              ? `mt-3 max-w-xs text-[0.92rem] leading-snug ${dark ? "text-bone" : "text-terracotta"}`
              : "sr-only"
          }
        >
          {error && dark && (
            <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-terracotta mr-2 align-middle" />
          )}
          {error}
        </p>
      </div>
    </div>
  );
}
