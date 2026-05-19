import Stripe from "stripe";
import { getCloudflareContext } from "@opennextjs/cloudflare";

export async function getStripe(): Promise<Stripe> {
  const { env } = await getCloudflareContext();
  const key = (env as unknown as Record<string, string>).STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }
  return new Stripe(key, {
    httpClient: Stripe.createFetchHttpClient(),
  });
}

export async function createCheckoutSession({
  eventId,
  eventName,
  entryFeeCents,
  userId,
  userEmail,
  successUrl,
  cancelUrl,
}: {
  eventId: string;
  eventName: string;
  entryFeeCents: number;
  userId: string;
  userEmail: string;
  successUrl: string;
  cancelUrl: string;
}) {
  const stripe = await getStripe();

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "aud",
          product_data: {
            name: eventName,
            description: "Event entry · Running TT",
          },
          unit_amount: entryFeeCents,
        },
        quantity: 1,
      },
    ],
    mode: "payment",
    success_url: successUrl,
    cancel_url: cancelUrl,
    customer_email: userEmail,
    metadata: {
      event_id: eventId,
      user_id: userId,
    },
  });

  return session;
}
