import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { getSession } from "@/lib/auth";

interface SponsorRef {
  name: string;
  url: string;
}

interface ProfilePatch {
  name?: string;
  location?: string;
  bio?: string;
  instagram?: string;
  stravaUrl?: string;
  tiktok?: string;
  website?: string;
  sponsors?: SponsorRef[];
  sponsorInterests?: string;
  openToSponsorship?: boolean;
}

const TEXT_LIMITS: Record<string, number> = {
  name: 80,
  location: 80,
  bio: 600,
  instagram: 60,
  stravaUrl: 200,
  tiktok: 60,
  website: 200,
  sponsorInterests: 300,
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
  if (body.location !== undefined) {
    updates.push("location = ?");
    values.push(clean(body.location, TEXT_LIMITS.location));
  }
  if (body.bio !== undefined) {
    updates.push("bio = ?");
    values.push(clean(body.bio, TEXT_LIMITS.bio));
  }
  if (body.instagram !== undefined) {
    updates.push("instagram = ?");
    values.push(clean(body.instagram, TEXT_LIMITS.instagram).replace(/^@/, ""));
  }
  if (body.stravaUrl !== undefined) {
    updates.push("strava_url = ?");
    values.push(clean(body.stravaUrl, TEXT_LIMITS.stravaUrl));
  }
  if (body.tiktok !== undefined) {
    updates.push("tiktok = ?");
    values.push(clean(body.tiktok, TEXT_LIMITS.tiktok).replace(/^@/, ""));
  }
  if (body.website !== undefined) {
    updates.push("website = ?");
    values.push(clean(body.website, TEXT_LIMITS.website));
  }
  if (body.sponsors !== undefined) {
    const sponsors = Array.isArray(body.sponsors)
      ? body.sponsors
          .map((s) => ({
            name: clean(s?.name, 60),
            url: clean(s?.url, 200),
          }))
          .filter((s) => s.name)
          .slice(0, 10)
      : [];
    updates.push("sponsors = ?");
    values.push(JSON.stringify(sponsors));
  }
  if (body.sponsorInterests !== undefined) {
    updates.push("sponsor_interests = ?");
    values.push(clean(body.sponsorInterests, TEXT_LIMITS.sponsorInterests));
  }
  if (body.openToSponsorship !== undefined) {
    updates.push("open_to_sponsorship = ?");
    values.push(body.openToSponsorship ? 1 : 0);
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

  return NextResponse.json({ success: true });
}
