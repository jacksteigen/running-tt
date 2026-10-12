import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { getStripe } from "@/lib/stripe";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { confirmPaidCheckout, releaseExpiredCheckout } from "@/lib/bookings";

export async function POST(request: NextRequest) {
  const body = await request.text();
  const sig = request.headers.get("stripe-signature");
  const { env } = await getCloudflareContext();
  const webhookSecret = (env as unknown as Record<string, string>).STRIPE_WEBHOOK_SECRET;

  if (!sig || !webhookSecret) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const stripe = await getStripe();

  let event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, sig, webhookSecret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const db = await getDB();

  if (
    event.type === "checkout.session.completed" ||
    event.type === "checkout.session.async_payment_succeeded"
  ) {
    const s = event.data.object;
    const outcome = await confirmPaidCheckout(db, {
      id: s.id,
      payment_status: s.payment_status,
      metadata: (s.metadata ?? null) as Record<string, string> | null,
    });
    // Ask Stripe to retry if the entry is missing; it may be a timing gap.
    if (outcome === "not_found") {
      return NextResponse.json({ error: "Entry not found" }, { status: 500 });
    }
  }

  if (event.type === "checkout.session.expired") {
    await releaseExpiredCheckout(db, event.data.object.id);
  }

  return NextResponse.json({ received: true });
}
