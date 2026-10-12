import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { generateId } from "@/lib/auth";
import { requireAdmin } from "@/lib/adminAuth";
import { ageGroupOn } from "@/lib/agegroups";
import { OCCUPYING_SQL, type HeatConfig } from "@/lib/heats";
import { confirmPaidCheckout, sendConfirmationOnce } from "@/lib/bookings";
import { expireCheckoutSession, retrieveCheckoutSession } from "@/lib/stripe";

/**
 * Add an athlete to an event by hand (walk-ups, comps, fixes). Respects heat
 * capacity unless `force` is set, so a full heat needs a deliberate yes.
 */
export async function POST(request: NextRequest) {
  const db = await getDB();
  const auth = await requireAdmin(db);
  if (auth.denied) return auth.denied;

  let eventId = "";
  let userId = "";
  let heatNumber: number | null = null;
  let force = false;
  let notify = false;
  try {
    const body = (await request.json()) as {
      eventId?: string; userId?: string; heatNumber?: number | string | null; force?: boolean; notify?: boolean;
    };
    eventId = typeof body.eventId === "string" ? body.eventId : "";
    userId = typeof body.userId === "string" ? body.userId : "";
    const h = Number(body.heatNumber);
    heatNumber = Number.isInteger(h) && h > 0 ? h : null;
    force = body.force === true;
    notify = body.notify === true;
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const event = await db
    .prepare("SELECT id, date, first_heat_time, heat_interval_minutes, heat_count, heat_capacity FROM events WHERE id = ?")
    .bind(eventId)
    .first<HeatConfig & { id: string; date: string }>();
  const user = await db
    .prepare("SELECT id, date_of_birth FROM users WHERE id = ?")
    .bind(userId)
    .first<{ id: string; date_of_birth: string | null }>();

  if (!event || !user) {
    return NextResponse.json({ error: "Event or athlete not found" }, { status: 404 });
  }

  const withHeats = (event.heat_count ?? 0) > 0;
  if (withHeats) {
    if (!heatNumber || heatNumber > (event.heat_count as number)) {
      return NextResponse.json({ error: "Pick a heat for this athlete" }, { status: 400 });
    }
    if (!force) {
      const n = await db
        .prepare(`SELECT COUNT(*) as n FROM entries WHERE event_id = ? AND heat_number = ? AND user_id != ? AND ${OCCUPYING_SQL}`)
        .bind(eventId, heatNumber, userId)
        .first<{ n: number }>();
      if ((n?.n ?? 0) >= (event.heat_capacity ?? 10)) {
        return NextResponse.json(
          { error: `Heat ${heatNumber} is full.`, code: "HEAT_FULL" },
          { status: 409 }
        );
      }
    }
  } else {
    heatNumber = null;
  }

  const ageGroup = ageGroupOn(user.date_of_birth, event.date);
  const existing = await db
    .prepare("SELECT id, status, stripe_payment_id FROM entries WHERE event_id = ? AND user_id = ?")
    .bind(eventId, userId)
    .first<{ id: string; status: string; stripe_payment_id: string | null }>();

  let entryId: string;
  if (existing) {
    entryId = existing.id;
    // An abandoned checkout: close it so the athlete cannot also pay, and
    // drop its id so the start list does not show them as paid online.
    let clearCheckout = false;
    if (existing.status === "pending" && existing.stripe_payment_id) {
      const outcome = await expireCheckoutSession(existing.stripe_payment_id);
      if (outcome === "paid") {
        const checkout = await retrieveCheckoutSession(existing.stripe_payment_id).catch(() => null);
        if (checkout) {
          await confirmPaidCheckout(db, {
            id: checkout.id,
            payment_status: checkout.payment_status,
            metadata: (checkout.metadata ?? null) as Record<string, string> | null,
          });
        }
        return NextResponse.json({ success: true, entryId, note: "They had already paid online." });
      }
      if (outcome === "unknown") {
        return NextResponse.json(
          { error: "Could not reach Stripe to close their checkout. Try again in a minute." },
          { status: 502 }
        );
      }
      clearCheckout = true;
    }
    await db
      .prepare(
        `UPDATE entries SET status = 'confirmed', age_group = ?, heat_number = ?${
          clearCheckout ? ", stripe_payment_id = NULL" : ""
        } WHERE id = ?`
      )
      .bind(ageGroup, heatNumber, entryId)
      .run();
  } else {
    entryId = `ent_${generateId()}`;
    await db
      .prepare(
        "INSERT INTO entries (id, event_id, user_id, status, age_group, heat_number) VALUES (?, ?, ?, 'confirmed', ?, ?)"
      )
      .bind(entryId, eventId, userId, ageGroup, heatNumber)
      .run();
  }

  if (notify) await sendConfirmationOnce(db, entryId);
  return NextResponse.json({ success: true, entryId });
}
