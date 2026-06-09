"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface SponsorRef {
  name: string;
  url: string;
}

interface ProfileFormProps {
  user: {
    name: string;
    location: string | null;
    bio?: string | null;
    photoUrl?: string | null;
    instagram?: string | null;
    stravaUrl?: string | null;
    tiktok?: string | null;
    website?: string | null;
    sponsors?: string | null; // JSON string
    sponsorInterests?: string | null;
    openToSponsorship?: number;
  };
}

const inputCls =
  "w-full border border-stone/40 px-3 py-2 text-sm bg-bone/50 focus:outline-none focus:border-terracotta transition-colors";
const labelCls = "block text-xs text-dust mb-1";

export default function ProfileForm({ user }: ProfileFormProps) {
  const router = useRouter();

  let initialSponsors: SponsorRef[] = [];
  try {
    initialSponsors = user.sponsors ? JSON.parse(user.sponsors) : [];
  } catch {
    initialSponsors = [];
  }

  const [name, setName] = useState(user.name);
  const [location, setLocation] = useState(user.location || "");
  const [bio, setBio] = useState(user.bio || "");
  const [instagram, setInstagram] = useState(user.instagram || "");
  const [stravaUrl, setStravaUrl] = useState(user.stravaUrl || "");
  const [tiktok, setTiktok] = useState(user.tiktok || "");
  const [website, setWebsite] = useState(user.website || "");
  const [sponsors, setSponsors] = useState<SponsorRef[]>(initialSponsors);
  const [sponsorInterests, setSponsorInterests] = useState(
    user.sponsorInterests || ""
  );
  const [openToSponsorship, setOpenToSponsorship] = useState(
    (user.openToSponsorship ?? 1) === 1
  );

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoUrl, setPhotoUrl] = useState(user.photoUrl || "");
  const [error, setError] = useState("");

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setPhotoUploading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("photo", file);
      const res = await fetch("/api/profile/photo", {
        method: "POST",
        body: formData,
      });
      const data = (await res.json()) as {
        success?: boolean;
        photoUrl?: string;
        error?: string;
      };
      if (data.photoUrl) {
        setPhotoUrl(data.photoUrl);
        router.refresh();
      } else {
        setError(data.error || "Upload failed");
      }
    } catch {
      setError("Upload failed. Try again.");
    } finally {
      setPhotoUploading(false);
    }
  }

  function updateSponsor(i: number, field: keyof SponsorRef, value: string) {
    setSponsors((prev) =>
      prev.map((s, idx) => (idx === i ? { ...s, [field]: value } : s))
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setError("");

    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        location,
        bio,
        instagram,
        stravaUrl,
        tiktok,
        website,
        sponsors: sponsors.filter((s) => s.name.trim()),
        sponsorInterests,
        openToSponsorship,
      }),
    });

    setSaving(false);
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setError(data.error || "Could not save");
      return;
    }
    setSaved(true);
    router.refresh();
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white border border-stone/40 p-6"
    >
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-dust mb-3">
        Your public profile
      </p>
      <h3 className="font-semibold tracking-tight mb-4">Profile</h3>

      <div className="space-y-4">
        {/* Photo */}
        <div>
          <span className={labelCls}>Profile photo</span>
          <div className="flex items-center gap-3">
            {photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photoUrl}
                alt="Profile"
                className="w-14 h-14 object-cover border border-stone/40"
              />
            ) : (
              <div className="w-14 h-14 bg-stone/40 border border-stone/40" />
            )}
            <label className="text-xs font-medium text-terracotta border border-terracotta/30 px-3 py-1.5 hover:bg-terracotta/5 transition-colors cursor-pointer">
              {photoUploading
                ? "Uploading..."
                : photoUrl
                  ? "Replace photo"
                  : "Upload photo"}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handlePhotoChange}
                className="hidden"
                disabled={photoUploading}
              />
            </label>
          </div>
          <p className="text-[11px] text-midnight/40 mt-1">
            JPG, PNG or WebP, up to 5 MB.
          </p>
        </div>

        <div>
          <label htmlFor="name" className={labelCls}>
            Name
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputCls}
          />
        </div>

        <div>
          <label htmlFor="location" className={labelCls}>
            Location
          </label>
          <input
            id="location"
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="e.g. London, UK"
            className={inputCls}
          />
        </div>

        <div>
          <label htmlFor="bio" className={labelCls}>
            About you
          </label>
          <textarea
            id="bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={4}
            maxLength={600}
            placeholder="Who you are, what you're chasing."
            className={inputCls}
          />
        </div>

        {/* Socials */}
        <div className="pt-2 border-t border-stone/30">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-dust mb-3 mt-2">
            Socials
          </p>
          <div className="space-y-3">
            <div>
              <label htmlFor="instagram" className={labelCls}>
                Instagram handle
              </label>
              <input
                id="instagram"
                type="text"
                value={instagram}
                onChange={(e) => setInstagram(e.target.value)}
                placeholder="yourhandle"
                className={inputCls}
              />
            </div>
            <div>
              <label htmlFor="tiktok" className={labelCls}>
                TikTok handle
              </label>
              <input
                id="tiktok"
                type="text"
                value={tiktok}
                onChange={(e) => setTiktok(e.target.value)}
                placeholder="yourhandle"
                className={inputCls}
              />
            </div>
            <div>
              <label htmlFor="stravaUrl" className={labelCls}>
                Strava profile URL
              </label>
              <input
                id="stravaUrl"
                type="url"
                value={stravaUrl}
                onChange={(e) => setStravaUrl(e.target.value)}
                placeholder="https://www.strava.com/athletes/..."
                className={inputCls}
              />
            </div>
            <div>
              <label htmlFor="website" className={labelCls}>
                Website
              </label>
              <input
                id="website"
                type="url"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://..."
                className={inputCls}
              />
            </div>
          </div>
        </div>

        {/* Sponsorship */}
        <div className="pt-2 border-t border-stone/30">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-dust mb-3 mt-2">
            Sponsorship
          </p>

          <div className="space-y-3">
            {sponsors.map((s, i) => (
              <div key={i} className="flex gap-2">
                <input
                  type="text"
                  value={s.name}
                  onChange={(e) => updateSponsor(i, "name", e.target.value)}
                  placeholder="Sponsor name"
                  className={inputCls}
                />
                <input
                  type="url"
                  value={s.url}
                  onChange={(e) => updateSponsor(i, "url", e.target.value)}
                  placeholder="https://..."
                  className={inputCls}
                />
                <button
                  type="button"
                  onClick={() =>
                    setSponsors((prev) => prev.filter((_, idx) => idx !== i))
                  }
                  aria-label="Remove sponsor"
                  className="shrink-0 text-dust hover:text-terracotta px-2 transition-colors"
                >
                  ×
                </button>
              </div>
            ))}
            {sponsors.length < 10 && (
              <button
                type="button"
                onClick={() =>
                  setSponsors((prev) => [...prev, { name: "", url: "" }])
                }
                className="text-xs font-medium text-terracotta hover:text-terracotta/80 transition-colors"
              >
                + Add a sponsor
              </button>
            )}
          </div>

          <div className="mt-4">
            <label htmlFor="sponsorInterests" className={labelCls}>
              What backing are you looking for?
            </label>
            <input
              id="sponsorInterests"
              type="text"
              value={sponsorInterests}
              onChange={(e) => setSponsorInterests(e.target.value)}
              placeholder="e.g. Footwear, nutrition, travel support"
              className={inputCls}
            />
          </div>

          <label className="flex items-start gap-2.5 cursor-pointer select-none mt-4">
            <input
              type="checkbox"
              checked={openToSponsorship}
              onChange={(e) => setOpenToSponsorship(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-[#C4593A]"
            />
            <span className="text-xs text-midnight/70 leading-relaxed">
              Show an &quot;Open to sponsors&quot; badge on my public profile
            </span>
          </label>
        </div>

        {error && <p className="text-sm text-terracotta">{error}</p>}

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
