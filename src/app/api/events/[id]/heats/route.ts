import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { getHeatAvailability, type HeatConfig } from "@/lib/heats";

/** Live spots-left for each heat, so the booking page stays current. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = await getDB();
  const event = await db
    .prepare(
      "SELECT id, first_heat_time, heat_interval_minutes, heat_count, heat_capacity FROM events WHERE id = ?"
    )
    .bind(id)
    .first<HeatConfig & { id: string }>();

  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

  const heats = await getHeatAvailability(db, event);
  return NextResponse.json(
    {
      heats: heats.map((h) => ({
        number: h.number,
        label: h.label,
        capacity: h.capacity,
        booked: h.booked,
        remaining: h.remaining,
        full: h.full,
      })),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
