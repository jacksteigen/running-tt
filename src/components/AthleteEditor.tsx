"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import CountrySelect from "@/components/CountrySelect";
import { CategoryChoice } from "@/components/WalkUpForm";
import type { RaceCategory } from "@/lib/categories";

interface AthleteFields {
  firstName: string;
  middleName: string;
  lastName: string;
  dateOfBirth: string;
  raceCategory: RaceCategory | null;
  city: string;
  country: string;
  bio: string;
  isAdmin: boolean;
}

const inputCls =
  "w-full border border-stone/40 px-3 py-2.5 text-sm bg-bone/50 focus:outline-none focus:border-terracotta transition-colors";
const labelCls = "block text-xs text-dust mb-1";

export default function AthleteEditor({
  athleteId,
  initial,
  isSelf,
}: {
  athleteId: string;
  initial: AthleteFields;
  isSelf: boolean;
}) {
  const router = useRouter();
  const [form, setForm] = useState<AthleteFields>(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  function set<K extends keyof AthleteFields>(key: K, value: AthleteFields[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      const res = await fetch(`/api/admin/athletes/${athleteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: form.firstName,
          middleName: form.middleName,
          lastName: form.lastName,
          dateOfBirth: form.dateOfBirth,
          raceCategory: form.raceCategory,
          city: form.city,
          country: form.country,
          bio: form.bio,
          isAdmin: form.isAdmin,
        }),
      });
      const data = (await res.json()) as { success?: boolean; error?: string };
      if (data.success) {
        setSaved(true);
        router.refresh();
        setTimeout(() => setSaved(false), 2000);
      } else {
        setError(data.error || "Could not save");
      }
    } catch {
      setError("Could not connect");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-stone/40 p-6 space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label htmlFor="a-first" className={labelCls}>First name</label>
          <input id="a-first" value={form.firstName} onChange={(e) => set("firstName", e.target.value)} className={inputCls} />
        </div>
        <div>
          <label htmlFor="a-middle" className={labelCls}>Middle name</label>
          <input id="a-middle" value={form.middleName} onChange={(e) => set("middleName", e.target.value)} className={inputCls} />
        </div>
        <div>
          <label htmlFor="a-last" className={labelCls}>Last name</label>
          <input id="a-last" value={form.lastName} onChange={(e) => set("lastName", e.target.value)} className={inputCls} />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label htmlFor="a-dob" className={labelCls}>Date of birth</label>
          <input id="a-dob" type="date" value={form.dateOfBirth} onChange={(e) => set("dateOfBirth", e.target.value)} className={inputCls} />
        </div>
        <div>
          <label htmlFor="a-city" className={labelCls}>Town or city</label>
          <input id="a-city" autoComplete="off" maxLength={60} placeholder="e.g. Geelong" value={form.city} onChange={(e) => set("city", e.target.value)} className={inputCls} />
        </div>
        <div>
          <label htmlFor="a-country" className={labelCls}>Country</label>
          <CountrySelect
            id="a-country"
            value={form.country}
            onChange={(value) => set("country", value)}
            className={`${inputCls} cursor-pointer [&_option]:text-midnight ${form.country ? "" : "text-midnight/50"}`}
          />
        </div>
      </div>
      <p className="text-[11px] text-midnight/45 -mt-1">
        Date of birth sets the age group on every entry. With a town and country as well, the profile counts as complete.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
        <div className="sm:col-span-2">
          <CategoryChoice
            name="a-category"
            value={form.raceCategory}
            onChange={(value) => set("raceCategory", value)}
            labelClassName={labelCls}
            allowUnset
            describedBy="a-category-help"
          />
        </div>
        <p id="a-category-help" className="text-[11px] text-midnight/45 leading-relaxed sm:pb-1">
          When a race pays women and men separately, this is the field they race in. Changing it re-ranks their results.
        </p>
      </div>
      <div>
        <label htmlFor="a-bio" className={labelCls}>Short intro</label>
        <textarea id="a-bio" rows={3} maxLength={600} value={form.bio} onChange={(e) => set("bio", e.target.value)} className={inputCls} />
      </div>
      <label className={`flex items-center gap-2.5 select-none ${isSelf ? "opacity-60" : "cursor-pointer"}`}>
        <input
          type="checkbox"
          checked={form.isAdmin}
          disabled={isSelf}
          onChange={(e) => set("isAdmin", e.target.checked)}
          className="h-4 w-4 accent-[#C4593A]"
        />
        <span className="text-sm">Admin access{isSelf ? " (that is you)" : ""}</span>
      </label>
      {error && <p role="alert" className="text-sm text-terracotta">{error}</p>}
      <button
        type="submit"
        disabled={saving}
        className="btn btn-ink"
      >
        {saving ? "Saving..." : saved ? "Saved" : "Save changes"}
      </button>
    </form>
  );
}
