import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { verifyMagicLink, findOrCreateUser, createSession } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(new URL("/login?error=missing_token", request.url));
  }

  const db = await getDB();
  const link = await verifyMagicLink(db, token);

  if (!link) {
    return NextResponse.redirect(
      new URL("/login?error=invalid_or_expired", request.url)
    );
  }

  const userId = await findOrCreateUser(db, link.email);
  await createSession(db, userId);

  return NextResponse.redirect(new URL("/dashboard", request.url));
}
