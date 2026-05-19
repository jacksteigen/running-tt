import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { getStripe } from "@/lib/stripe";
import { getCloudflareContext } from "@opennextjs/cloudflare";

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

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const eventId = session.metadata?.event_id;
    const userId = session.metadata?.user_id;

    if (eventId && userId) {
      const db = await getDB();
      await db
        .prepare(
          "UPDATE entries SET status = 'confirmed' WHERE event_id = ? AND user_id = ? AND status = 'pending'"
        )
        .bind(eventId, userId)
        .run();
    }
  }

  return NextResponse.json({ received: true });
}
