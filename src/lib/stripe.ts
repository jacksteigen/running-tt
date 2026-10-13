import Stripe from "stripe";
import { getCloudflareContext } from "@opennextjs/cloudflare";

/** Pinned so Stripe behaviour only changes when we choose to change it. */
const STRIPE_API_VERSION: Stripe.LatestApiVersion = "2026-03-25.dahlia";

async function getKey(): Promise<string> {
  const { env } = await getCloudflareContext();
  const key = (env as unknown as Record<string, string>).STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  return key;
}

export async function getStripe(): Promise<Stripe> {
  return new Stripe(await getKey(), {
    apiVersion: STRIPE_API_VERSION,
    httpClient: Stripe.createFetchHttpClient(),
  });
}

/** True while the account is on test keys, when no real money can move. */
export async function isStripeTestMode(): Promise<boolean> {
  try {
    // Secret (sk_) and restricted (rk_) keys both carry _test_ in test mode.
    return /^(sk|rk)_test_/.test(await getKey());
  } catch {
    return true;
  }
}

export async function createCheckoutSession({
  entryId,
  heatNumber,
  eventId,
  eventName,
  heatText,
  entryFeeCents,
  userId,
  userEmail,
  successUrl,
  cancelUrl,
}: {
  entryId: string;
  heatNumber: number | null;
  eventId: string;
  eventName: string;
  heatText: string;
  entryFeeCents: number;
  userId: string;
  userEmail: string;
  successUrl: string;
  cancelUrl: string;
}) {
  const stripe = await getStripe();

  return stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "aud",
          product_data: {
            name: eventName,
            description: heatText
              ? `${heatText} · Event entry · Running TT`
              : "Event entry · Running TT",
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
    // Payments run through Steigen's Stripe account. The suffix makes card
    // statements read "STEIGEN* RUNNING TT" so athletes recognise the
    // charge, and the brand tag lets Steigen's books filter Running TT.
    payment_intent_data: {
      description: `Running TT · ${eventName}${heatText ? ` · ${heatText}` : ""}`,
      statement_descriptor_suffix: "RUNNING TT",
      metadata: {
        brand: "running-tt",
        entry_id: entryId,
        event_id: eventId,
        user_id: userId,
      },
    },
    // The heat spot is held for HOLD_MINUTES; the session closes before that.
    expires_at: Math.floor(Date.now() / 1000) + 31 * 60,
    metadata: {
      brand: "running-tt",
      entry_id: entryId,
      event_id: eventId,
      user_id: userId,
      heat_number: heatNumber ? String(heatNumber) : "",
    },
  });
}

export async function retrieveCheckoutSession(id: string) {
  const stripe = await getStripe();
  return stripe.checkout.sessions.retrieve(id);
}

/**
 * Close an abandoned checkout so it can never be paid after its spot is
 * gone. Returns "closed" only when Stripe confirms the session is expired
 * and unpaid, "paid" when it turns out to have been paid, and "unknown"
 * when Stripe could not be reached, so callers never discard a payment.
 */
export async function expireCheckoutSession(
  id: string
): Promise<"closed" | "paid" | "unknown"> {
  try {
    const stripe = await getStripe();
    await stripe.checkout.sessions.expire(id);
    return "closed";
  } catch {
    // Expire refuses sessions that are already complete or expired. Ask.
    try {
      const session = await retrieveCheckoutSession(id);
      if (session.payment_status === "paid") return "paid";
      if (session.status === "expired") return "closed";
      if (session.status === "complete") return "paid";
      return "unknown";
    } catch {
      return "unknown";
    }
  }
}
