import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { createMagicLink } from "@/lib/auth";
import { sendMagicLinkEmail } from "@/lib/email";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  let email = "";
  let declared = false;
  try {
    const body = (await request.json()) as {
      email?: string;
      declared?: boolean;
    };
    email = typeof body.email === "string" ? body.email.trim() : "";
    declared = body.declared === true;
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (!email || email.length > 254 || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }

  if (!declared) {
    return NextResponse.json(
      { error: "The clean-sport declaration is required" },
      { status: 400 }
    );
  }

  const db = await getDB();

  // The declaration is recorded when the link is confirmed and the email is
  // proven to be the signer's; the flag travels with the link until then.
  const token = await createMagicLink(db, email, declared);
  const baseUrl = new URL(request.url).origin;

  try {
    const sent = await sendMagicLinkEmail(email, token, baseUrl);
    if (!sent.success) {
      return NextResponse.json(
        { error: "We could not send the email. Try again in a minute." },
        { status: 502 }
      );
    }
  } catch {
    return NextResponse.json(
      { error: "We could not send the email. Try again in a minute." },
      { status: 502 }
    );
  }

  return NextResponse.json({ success: true });
}
