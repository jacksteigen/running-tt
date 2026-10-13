import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { normaliseUrl } from "@/lib/urls";
import { composeLocation, isKnownCountry } from "@/lib/countries";
import { isRaceCategory, toRaceCategory, type RaceCategory } from "@/lib/categories";
import { hasCategoryResults, recomputeForAthlete } from "@/lib/standings";

interface SponsorRef {
  name: string;
  url: string;
}

interface ProfilePatch {
  name?: string;
  location?: string;
  city?: string;
  country?: string;
  bio?: string;
  story?: string;
  instagram?: string;
  stravaUrl?: string;
  tiktok?: string;
  website?: string;
  sponsors?: SponsorRef[];
  sponsorInterests?: string;
  dreamBrands?: string;
  openToSponsorship?: boolean;
  /** Women or Men. Left out to keep it as it is; an athlete cannot clear it. */
  raceCategory?: string | null;
}

const TEXT_LIMITS: Record<string, number> = {
  name: 80,
  location: 80,
  bio: 600,
  story: 4000,
  instagram: 60,
  stravaUrl: 300,
  tiktok: 60,
  website: 300,
  sponsorInterests: 300,
  dreamBrands: 300,
};

function clean(value: unknown, limit: number): string {
  return typeof value === "string" ? value.trim().slice(0, limit) : "";
}

export async function PATCH(request: NextRequest) {
  const db = await getDB();
  const session = await getSession(db);

  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = (await request.json()) as ProfilePatch;

  const updates: string[] = [];
  const values: (string | number)[] = [];

  if (body.name !== undefined) {
    const name = clean(body.name, TEXT_LIMITS.name);
    if (!name) {
      return NextResponse.json(
        { error: "Name cannot be empty" },
        { status: 400 }
      );
    }
    updates.push("name = ?");
    values.push(name);
  }
  if (body.city !== undefined || body.country !== undefined) {
    const city = clean(body.city, 60);
    const country = clean(body.country, 60);
    if (country && !isKnownCountry(country)) {
      return NextResponse.json({ error: "Pick your country from the list" }, { status: 400 });
    }
    updates.push("city = ?", "country = ?", "location = ?");
    values.push(city, country, composeLocation(city, country));
  } else if (body.location !== undefined) {
    updates.push("location = ?");
    values.push(clean(body.location, TEXT_LIMITS.location));
  }
  if (body.bio !== undefined) {
    updates.push("bio = ?");
    values.push(clean(body.bio, TEXT_LIMITS.bio));
  }
  if (body.story !== undefined) {
    updates.push("story = ?");
    values.push(clean(body.story, TEXT_LIMITS.story));
  }
  if (body.instagram !== undefined) {
    updates.push("instagram = ?");
    values.push(clean(body.instagram, TEXT_LIMITS.instagram).replace(/^@/, ""));
  }
  if (body.stravaUrl !== undefined) {
    const strava = normaliseUrl(clean(body.stravaUrl, TEXT_LIMITS.stravaUrl));
    if (strava === null) {
      return NextResponse.json(
        { error: "That Strava link does not look like a web address" },
        { status: 400 }
      );
    }
    updates.push("strava_url = ?");
    values.push(strava);
  }
  if (body.tiktok !== undefined) {
    updates.push("tiktok = ?");
    values.push(clean(body.tiktok, TEXT_LIMITS.tiktok).replace(/^@/, ""));
  }
  if (body.website !== undefined) {
    const website = normaliseUrl(clean(body.website, TEXT_LIMITS.website));
    if (website === null) {
      return NextResponse.json(
        { error: "That website link does not look like a web address" },
        { status: 400 }
      );
    }
    updates.push("website = ?");
    values.push(website);
  }
  if (body.sponsors !== undefined) {
    const raw = Array.isArray(body.sponsors) ? body.sponsors.slice(0, 10) : [];
    const sponsors: SponsorRef[] = [];
    for (const s of raw) {
      const name = clean(s?.name, 60);
      if (!name) continue;
      const url = normaliseUrl(clean(s?.url, 300));
      if (url === null) {
        return NextResponse.json(
          { error: `The link for "${name}" does not look like a web address` },
          { status: 400 }
        );
      }
      sponsors.push({ name, url });
    }
    updates.push("sponsors = ?");
    values.push(JSON.stringify(sponsors));
  }
  if (body.sponsorInterests !== undefined) {
    updates.push("sponsor_interests = ?");
    values.push(clean(body.sponsorInterests, TEXT_LIMITS.sponsorInterests));
  }
  if (body.dreamBrands !== undefined) {
    updates.push("dream_brands = ?");
    values.push(clean(body.dreamBrands, TEXT_LIMITS.dreamBrands));
  }
  if (body.openToSponsorship !== undefined) {
    updates.push("open_to_sponsorship = ?");
    values.push(body.openToSponsorship ? 1 : 0);
  }
  let categoryChanged = false;
  if (body.raceCategory !== undefined && body.raceCategory !== null) {
    if (!isRaceCategory(body.raceCategory)) {
      return NextResponse.json({ error: "Pick Women or Men" }, { status: 400 });
    }
    const raceCategory: RaceCategory = body.raceCategory;
    const current = await db
      .prepare("SELECT race_category FROM users WHERE id = ?")
      .bind(session.user.id)
      .first<{ race_category: string | null }>();
    categoryChanged = toRaceCategory(current?.race_category) !== raceCategory;
    // Once a category has decided places or prize money in a race, only an
    // admin can change it, the same as a date of birth.
    if (categoryChanged && (await hasCategoryResults(db, session.user.id))) {
      return NextResponse.json(
        { error: "Your category is set. Ask us if it needs changing." },
        { status: 409 }
      );
    }
    updates.push("race_category = ?");
    values.push(raceCategory);
  }

  if (updates.length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  updates.push("updated_at = datetime('now')");
  values.push(session.user.id);

  await db
    .prepare(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`)
    .bind(...values)
    .run();

  // Results already raced keep their category. This only fills in results
  // that have none yet, in races not paid by category.
  if (categoryChanged) await recomputeForAthlete(db, session.user.id);

  return NextResponse.json({ success: true });
}
