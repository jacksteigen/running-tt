import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { generateId } from "@/lib/auth";
import { sendAdminAlertEmail } from "@/lib/email";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function clean(value: unknown, limit: number): string {
  return typeof value === "string" ? value.trim().slice(0, limit) : "";
}

async function hashIp(ip: string): Promise<string> {
  const bytes = new TextEncoder().encode(`rtt-partners:${ip}`);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return Array.from(digest.slice(0, 12), (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * A brand asking to back the purse or partner with athletes. Stored, and
 * sent straight to the admins, so it never depends on a mailbox existing.
 */
export async function POST(request: NextRequest) {
  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  // Bots fill every field; people never see this one.
  if (clean(body.website, 200)) {
    return NextResponse.json({ success: true });
  }

  const name = clean(body.name, 80);
  const brand = clean(body.brand, 80);
  const email = clean(body.email, 254).toLowerCase();
  const interest = clean(body.interest, 60);
  const message = clean(body.message, 2000);

  if (!name) return NextResponse.json({ error: "Your name, please" }, { status: 400 });
  if (!brand) return NextResponse.json({ error: "Which brand are you with?" }, { status: 400 });
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "An email we can reply to" }, { status: 400 });
  }

  const db = await getDB();
  const ipHash = await hashIp(request.headers.get("cf-connecting-ip") ?? "unknown");

  const recent = await db
    .prepare(
      "SELECT COUNT(*) as n FROM partner_enquiries WHERE ip_hash = ? AND created_at > datetime('now', '-1 day')"
    )
    .bind(ipHash)
    .first<{ n: number }>();
  if ((recent?.n ?? 0) >= 5) {
    return NextResponse.json(
      { error: "We have your messages. We will be in touch soon." },
      { status: 429 }
    );
  }

  await db
    .prepare(
      "INSERT INTO partner_enquiries (id, name, brand, email, interest, message, ip_hash) VALUES (?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(`pen_${generateId()}`, name, brand, email, interest || null, message || null, ipHash)
    .run();

  const admins = (await db
    .prepare("SELECT email FROM users WHERE is_admin = 1")
    .all()) as unknown as { results: { email: string }[] };

  if (admins.results.length) {
    await sendAdminAlertEmail(
      admins.results.map((a) => a.email),
      `Brand enquiry: ${brand}`,
      [
        `${name} from ${brand} wants to talk about backing Running TT.`,
        `Email: ${email}`,
        interest ? `Interested in: ${interest}` : "",
        message ? `Message: ${message}` : "",
        "Reply to them directly at the email above.",
      ].filter(Boolean)
    ).catch(() => undefined);
  }

  return NextResponse.json({ success: true });
}
