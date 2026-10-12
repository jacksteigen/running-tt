import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { requireAdmin } from "@/lib/adminAuth";
import { OCCUPYING_SQL, type HeatConfig } from "@/lib/heats";
import { confirmPaidCheckout, sendHeatChangedEmail } from "@/lib/bookings";
import { expireCheckoutSession, retrieveCheckoutSession } from "@/lib/stripe";

/**
 * Move an athlete to another heat. This is how heat change requests are
 * actioned; it can resolve the request and email the athlete in one go.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = await getDB();
  const auth = await requireAdmin(db);
  if (auth.denied) return auth.denied;

  let heatNumber: number | null = null;
  let force = false;
  let notify = true;
  let resolveRequestId: string | null = null;
  try {
    const body = (await request.json()) as {
      heatNumber?: number | string; force?: boolean; notify?: boolean; resolveRequestId?: string;
    };
    const h = Number(body.heatNumber);
    heatNumber = Number.isInteger(h) && h > 0 ? h : null;
    force = body.force === true;
    notify = body.notify !== false;
    resolveRequestId = typeof body.resolveRequestId === "string" ? body.resolveRequestId : null;
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const entry = await db
    .prepare(
      `SELECT e.id, e.event_id, e.user_id, e.heat_number, e.status,
              ev.first_heat_time, ev.heat_interval_minutes, ev.heat_count, ev.heat_capacity
       FROM entries e JOIN events ev ON ev.id = e.event_id WHERE e.id = ?`
    )
    .bind(id)
    .first<HeatConfig & { id: string; event_id: string; user_id: string; heat_number: number | null; status: string }>();

  if (!entry) return NextResponse.json({ error: "Entry not found" }, { status: 404 });
  if (!heatNumber || heatNumber > (entry.heat_count ?? 0)) {
    return NextResponse.json({ error: "That heat does not exist" }, { status: 400 });
  }
  if (heatNumber === entry.heat_number) {
    return NextResponse.json({ success: true, unchanged: true });
  }

  if (!force) {
    const n = await db
      .prepare(`SELECT COUNT(*) as n FROM entries WHERE event_id = ? AND heat_number = ? AND id != ? AND ${OCCUPYING_SQL}`)
      .bind(entry.event_id, heatNumber, entry.id)
      .first<{ n: number }>();
    if ((n?.n ?? 0) >= (entry.heat_capacity ?? 10)) {
      return NextResponse.json({ error: `Heat ${heatNumber} is full.`, code: "HEAT_FULL" }, { status: 409 });
    }
  }

  await db.prepare("UPDATE entries SET heat_number = ? WHERE id = ?").bind(heatNumber, entry.id).run();
  await db
    .prepare("UPDATE results SET heat_number = ? WHERE event_id = ? AND user_id = ?")
    .bind(heatNumber, entry.event_id, entry.user_id)
    .run();

  if (resolveRequestId) {
    await db
      .prepare(
        "UPDATE heat_change_requests SET status = 'done', resolved_at = datetime('now'), resolved_by = ? WHERE id = ? AND entry_id = ?"
      )
      .bind(auth.session.user.id, resolveRequestId, entry.id)
      .run();
  }

  if (notify && entry.status === "confirmed") {
    await sendHeatChangedEmail(db, entry.id).catch(() => false);
  }

  return NextResponse.json({ success: true });
}

/** Remove an entry. A recorded result has to be cleared first. */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = await getDB();
  const auth = await requireAdmin(db);
  if (auth.denied) return auth.denied;

  const entry = await db
    .prepare("SELECT id, event_id, user_id, status, stripe_payment_id FROM entries WHERE id = ?")
    .bind(id)
    .first<{ id: string; event_id: string; user_id: string; status: string; stripe_payment_id: string | null }>();
  if (!entry) return NextResponse.json({ error: "Entry not found" }, { status: 404 });

  // Someone part way through paying: close their checkout first so it can
  // never be paid after the entry is gone. If they had already paid, keep
  // them in and say so.
  if (entry.status === "pending" && entry.stripe_payment_id) {
    const outcome = await expireCheckoutSession(entry.stripe_payment_id);
    if (outcome === "paid") {
      const checkout = await retrieveCheckoutSession(entry.stripe_payment_id).catch(() => null);
      if (checkout) {
        await confirmPaidCheckout(db, {
          id: checkout.id,
          payment_status: checkout.payment_status,
          metadata: (checkout.metadata ?? null) as Record<string, string> | null,
        });
      }
      return NextResponse.json(
        { error: "This athlete has just paid, so their entry is now confirmed. Refund in Stripe first if they should not race.", code: "PAID" },
        { status: 409 }
      );
    }
    if (outcome === "unknown") {
      return NextResponse.json(
        { error: "Could not reach Stripe to close their checkout. Try again in a minute." },
        { status: 502 }
      );
    }
  }

  const result = await db
    .prepare("SELECT id FROM results WHERE event_id = ? AND user_id = ?")
    .bind(entry.event_id, entry.user_id)
    .first();
  if (result) {
    return NextResponse.json(
      { error: "This athlete has a recorded time. Clear it before removing the entry." },
      { status: 400 }
    );
  }

  await db.prepare("DELETE FROM heat_change_requests WHERE entry_id = ?").bind(id).run();
  await db.prepare("DELETE FROM entries WHERE id = ?").bind(id).run();
  return NextResponse.json({ success: true });
}
