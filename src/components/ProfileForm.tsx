"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface ProfileFormProps {
  user: {
    name: string;
    location: string | null;
  };
}

export default function ProfileForm({ user }: ProfileFormProps) {
  const router = useRouter();
  const [name, setName] = useState(user.name);
  const [location, setLocation] = useState(user.location || "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);

    await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, location }),
    });

    setSaving(false);
    setSaved(true);
    router.refresh();
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white border border-stone/40 p-6"
    >
      <h3 className="font-semibold tracking-tight mb-4">Profile</h3>
      <div className="space-y-4">
        <div>
          <label htmlFor="name" className="block text-xs text-dust mb-1">
            Name
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border border-stone/40 px-3 py-2 text-sm bg-bone/50 focus:outline-none focus:border-terracotta transition-colors"
          />
        </div>
        <div>
          <label htmlFor="location" className="block text-xs text-dust mb-1">
            Location
          </label>
          <input
            id="location"
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="e.g. Geelong, VIC"
            className="w-full border border-stone/40 px-3 py-2 text-sm bg-bone/50 focus:outline-none focus:border-terracotta transition-colors"
          />
        </div>
        <button
          type="submit"
          disabled={saving}
          className="w-full bg-midnight text-white text-sm font-medium py-2.5 hover:bg-midnight/90 transition-colors disabled:opacity-50"
        >
          {saving ? "Saving..." : saved ? "Saved" : "Update profile"}
        </button>
      </div>
    </form>
  );
}
