"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface AthleteFields {
  firstName: string;
  middleName: string;
  lastName: string;
  dateOfBirth: string;
  location: string;
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
        body: JSON.stringify(form),
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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label htmlFor="a-dob" className={labelCls}>Date of birth</label>
          <input id="a-dob" type="date" value={form.dateOfBirth} onChange={(e) => set("dateOfBirth", e.target.value)} className={inputCls} />
        </div>
        <div>
          <label htmlFor="a-loc" className={labelCls}>Location</label>
          <input id="a-loc" value={form.location} onChange={(e) => set("location", e.target.value)} className={inputCls} />
        </div>
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
        className="bg-midnight text-white text-sm font-medium px-6 py-2.5 hover:bg-midnight/90 transition-colors disabled:opacity-50"
      >
        {saving ? "Saving..." : saved ? "Saved" : "Save changes"}
      </button>
    </form>
  );
}
