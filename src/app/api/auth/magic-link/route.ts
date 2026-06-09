import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { createMagicLink, generateId } from "@/lib/auth";
import { sendMagicLinkEmail } from "@/lib/email";
import { CLEAN_SPORT_DECLARATION } from "@/lib/declaration";

export async function POST(request: NextRequest) {
  const { email, declared } = (await request.json()) as {
    email: string;
    declared?: boolean;
  };

  if (!email || typeof email !== "string" || !email.includes("@")) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }

  if (!declared) {
    return NextResponse.json(
      { error: "The clean-sport declaration is required" },
      { status: 400 }
    );
  }

  const db = await getDB();

  // Record the declaration against the email; the account may not exist yet.
  await db
    .prepare(
      "INSERT INTO declarations (id, email, context, declaration_text) VALUES (?, ?, 'signup', ?)"
    )
    .bind(`dec_${generateId()}`, email.toLowerCase(), CLEAN_SPORT_DECLARATION)
    .run();

  const token = await createMagicLink(db, email);
  const baseUrl = new URL(request.url).origin;

  await sendMagicLinkEmail(email, token, baseUrl);

  return NextResponse.json({ success: true });
}
