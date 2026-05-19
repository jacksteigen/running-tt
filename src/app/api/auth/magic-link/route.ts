import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { createMagicLink } from "@/lib/auth";
import { sendMagicLinkEmail } from "@/lib/email";

export async function POST(request: NextRequest) {
  const { email } = (await request.json()) as { email: string };

  if (!email || typeof email !== "string" || !email.includes("@")) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }

  const db = await getDB();
  const token = await createMagicLink(db, email);
  const baseUrl = new URL(request.url).origin;

  await sendMagicLinkEmail(email, token, baseUrl);

  return NextResponse.json({ success: true });
}
