"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import CountrySelect from "@/components/CountrySelect";
import { isKnownCountry } from "@/lib/countries";
import { fieldInputCls, fieldLabelCls, fieldTextareaCls } from "@/components/fieldStyles";

interface SponsorRef {
  name: string;
  url: string;
}

interface ProfileFormProps {
  user: {
    name: string;
    location: string | null;
    city?: string | null;
    country?: string | null;
    bio?: string | null;
    story?: string | null;
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

// 16px text so phones do not zoom in on focus.
const inputCls = fieldInputCls;
const textareaCls = fieldTextareaCls;
const labelCls = fieldLabelCls;
const hintCls = "text-[0.8rem] text-midnight/50 mt-1.5 leading-relaxed";
const groupCls = "border-t border-midnight/10 pt-8";

/**
 * Profiles saved before city and country were split only have a single
 * location line. Pull the country off the end when it is one we know, so
 * saving the form never wipes where someone is from.
 */
function initialPlace(user: ProfileFormProps["user"]) {
  if (user.city || user.country) {
    return { city: user.city ?? "", country: user.country ?? "" };
  }
  const legacy = (user.location ?? "").trim();
  const parts = legacy.split(",").map((p) => p.trim()).filter(Boolean);
  const last = parts[parts.length - 1];
  if (parts.length > 1 && isKnownCountry(last)) {
    return { city: parts.slice(0, -1).join(", "), country: last };
  }
  if (parts.length === 1 && isKnownCountry(last)) {
    return { city: "", country: last };
  }
  return { city: legacy, country: "" };
}

export default function ProfileForm({ user }: ProfileFormProps) {
  const router = useRouter();

  let initialSponsors: SponsorRef[] = [];
  try {
    initialSponsors = user.sponsors ? JSON.parse(user.sponsors) : [];
  } catch {
    initialSponsors = [];
  }

  const [name, setName] = useState(user.name);
  const place = initialPlace(user);
  const [city, setCity] = useState(place.city);
  const [country, setCountry] = useState(place.country);
  const [bio, setBio] = useState(user.bio || "");
  const [story, setStory] = useState(user.story || "");
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

    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          city,
          country,
          bio,
          story,
          instagram,
          stravaUrl,
          tiktok,
          website,
          sponsors: sponsors.filter((s) => s.name.trim()),
          sponsorInterests,
          openToSponsorship,
        }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error || "Could not save");
        return;
      }
      setSaved(true);
      router.refresh();
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setError("Could not connect. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border rule p-6 md:p-10">
      <h3 className="t-headline text-[1.6rem] md:text-[1.9rem]">About you</h3>
      <p className="mt-2 text-[0.95rem] text-midnight/60 leading-relaxed max-w-md">
        Everything here is shown on your public athlete page.
      </p>

      <div className="mt-8 space-y-8">
        {/* Photo */}
        <div>
          <span className={labelCls}>Profile photo</span>
          <div className="flex items-center gap-5">
            {photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photoUrl}
                alt="Profile"
                className="w-20 h-24 object-cover bg-stone"
              />
            ) : (
              <div aria-hidden className="w-20 h-24 bg-stone" />
            )}
            <div>
              <label
                className={`btn btn-sm btn-ghost cursor-pointer has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-terracotta ${
                  photoUploading ? "opacity-45 cursor-wait" : ""
                }`}
              >
                {photoUploading
                  ? "Uploading..."
                  : photoUrl
                    ? "Replace photo"
                    : "Upload photo"}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handlePhotoChange}
                  className="sr-only"
                  disabled={photoUploading}
                />
              </label>
              <p className={hintCls}>JPG, PNG or WebP, up to 5 MB.</p>
            </div>
          </div>
        </div>

        <div className="space-y-5">
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label htmlFor="city" className={labelCls}>
                Town or city
              </label>
              <input
                id="city"
                type="text"
                autoComplete="address-level2"
                maxLength={60}
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g. Geelong"
                className={inputCls}
              />
            </div>
            <div>
              <label htmlFor="country" className={labelCls}>
                Country
              </label>
              <CountrySelect
                id="country"
                value={country}
                onChange={setCountry}
                className={`${inputCls} cursor-pointer [&_option]:text-midnight ${country ? "" : "text-midnight/50"}`}
              />
            </div>
          </div>

          <div>
            <label htmlFor="bio" className={labelCls}>
              Short intro
            </label>
            <textarea
              id="bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              maxLength={600}
              placeholder="Who you are, what you're chasing."
              className={textareaCls}
            />
            <p className={hintCls}>The line that sits under your name.</p>
          </div>

          <div>
            <label htmlFor="story" className={labelCls}>
              Your story
            </label>
            <textarea
              id="story"
              value={story}
              onChange={(e) => setStory(e.target.value)}
              rows={8}
              maxLength={4000}
              placeholder="Where you started, what you have run, what you are working towards, who you train with. Anyone looking at your profile reads this."
              className={textareaCls}
            />
            <p className={hintCls}>
              <span className="t-numeral">{story.length} / 4000</span> characters.
              Take your time with it.
            </p>
          </div>
        </div>

        {/* Socials */}
        <div className={groupCls}>
          <h4 className="t-headline text-[1.3rem]">Socials</h4>
          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-5">
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
                type="text"
                inputMode="url"
                value={stravaUrl}
                onChange={(e) => setStravaUrl(e.target.value)}
                placeholder="www.strava.com/athletes/..."
                className={inputCls}
              />
            </div>
            <div>
              <label htmlFor="website" className={labelCls}>
                Website
              </label>
              <input
                id="website"
                type="text"
                inputMode="url"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="www.yoursite.com"
                className={inputCls}
              />
              <p className={hintCls}>No need to type https, just the address.</p>
            </div>
          </div>
        </div>

        {/* Sponsorship */}
        <div className={groupCls}>
          <h4 className="t-headline text-[1.3rem]">Sponsorship</h4>

          <div className="mt-5 space-y-3">
            {sponsors.map((s, i) => (
              // Phones: name and remove on one line, website below.
              // Wider: name, website, remove across one line.
              <div
                key={i}
                className="grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_1fr_auto] gap-2 items-start"
              >
                <input
                  type="text"
                  value={s.name}
                  onChange={(e) => updateSponsor(i, "name", e.target.value)}
                  placeholder="Sponsor name"
                  aria-label="Sponsor name"
                  className={inputCls}
                />
                <input
                  type="text"
                  inputMode="url"
                  value={s.url}
                  onChange={(e) => updateSponsor(i, "url", e.target.value)}
                  placeholder="www.sponsor.com"
                  aria-label="Sponsor website"
                  className={`${inputCls} col-start-1 sm:col-start-auto`}
                />
                <button
                  type="button"
                  onClick={() =>
                    setSponsors((prev) => prev.filter((_, idx) => idx !== i))
                  }
                  aria-label="Remove sponsor"
                  className="row-start-1 col-start-2 sm:row-start-auto sm:col-start-auto w-11 h-11 flex items-center justify-center text-xl text-dust hover:text-terracotta transition-colors"
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
                className="link-quiet min-h-11 text-[0.95rem] text-midnight"
              >
                Add a sponsor
              </button>
            )}
          </div>

          <div className="mt-5">
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

          <label className="flex items-start gap-3 cursor-pointer select-none mt-6">
            <input
              type="checkbox"
              checked={openToSponsorship}
              onChange={(e) => setOpenToSponsorship(e.target.checked)}
              className="mt-0.5 h-5 w-5 shrink-0 accent-[#C4593A]"
            />
            <span className="text-[0.95rem] text-midnight/75 leading-relaxed">
              Show an &quot;Open to sponsors&quot; badge on my public profile
            </span>
          </label>
        </div>

        <div className="border-t border-midnight/10 pt-8">
          {error && (
            <p role="alert" className="mb-4 text-[0.95rem] text-terracotta">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={saving}
            className="btn btn-ink w-full sm:w-auto"
          >
            {saving ? "Saving..." : saved ? "Saved" : "Update profile"}
          </button>
        </div>
      </div>
    </form>
  );
}
