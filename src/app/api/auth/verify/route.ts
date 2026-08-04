import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import {
  consumeMagicLink,
  findOrCreateUser,
  createSession,
  generateId,
} from "@/lib/auth";
import { CLEAN_SPORT_DECLARATION } from "@/lib/declaration";

/**
 * The emailed link lands here as a GET. Email security scanners prefetch
 * links, so a GET must never consume the token; we hand off to a
 * confirmation page whose button posts back to actually sign in.
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(
      new URL("/login?error=missing_token", request.url)
    );
  }

  return NextResponse.redirect(
    new URL(`/login/verify?token=${encodeURIComponent(token)}`, request.url)
  );
}

export async function POST(request: NextRequest) {
  let token: string | null = null;
  try {
    const form = await request.formData();
    const value = form.get("token");
    token = typeof value === "string" ? value : null;
  } catch {
    token = null;
  }

  if (!token) {
    return NextResponse.redirect(
      new URL("/login?error=missing_token", request.url),
      303
    );
  }

  const db = await getDB();
  const link = await consumeMagicLink(db, token);

  if (!link) {
    return NextResponse.redirect(
      new URL("/login?error=invalid_or_expired", request.url),
      303
    );
  }

  const { id: userId } = await findOrCreateUser(db, link.email);

  // Record the signed declaration against the now-proven account, once.
  if (link.declared) {
    const existing = await db
      .prepare(
        "SELECT id FROM declarations WHERE user_id = ? AND context = 'signup' LIMIT 1"
      )
      .bind(userId)
      .first<{ id: string }>();

    if (!existing) {
      await db
        .prepare(
          "INSERT INTO declarations (id, user_id, email, context, declaration_text) VALUES (?, ?, ?, 'signup', ?)"
        )
        .bind(`dec_${generateId()}`, userId, link.email, CLEAN_SPORT_DECLARATION)
        .run();
    }
  }

  await createSession(db, userId);

  return NextResponse.redirect(new URL("/dashboard", request.url), 303);
}
