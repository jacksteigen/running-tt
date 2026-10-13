import { DATE_TBC } from "@/lib/dates";
import { formatClock, isValidClock } from "@/lib/heats";

export const EVENT_STATUSES = ["Coming Soon", "Open", "Sold Out"] as const;

export interface EventFields {
  name: string;
  distance: string;
  date: string;
  time: string;
  venue: string;
  location: string;
  status: string;
  entry_fee_cents: number;
  description: string | null;
  check_in: string | null;
  what_to_bring: string | null;
  prizes: string | null;
  first_heat_time: string | null;
  heat_interval_minutes: number | null;
  heat_count: number | null;
  heat_capacity: number | null;
  change_fee_cents: number | null;
  is_test: number;
}

function str(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

function intIn(v: unknown, min: number, max: number): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  if (!Number.isFinite(n)) return null;
  const r = Math.round(n);
  return r >= min && r <= max ? r : null;
}

function dollarsToCents(v: unknown, max: number): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  if (!Number.isFinite(n) || n < 0 || n > max) return null;
  return Math.round(n * 100);
}

/** Words a slug cannot be, because a fixed route already uses that path. */
const RESERVED_SLUGS = new Set(["new", "edit", "book", "booked", "qr"]);

export function slugify(input: string): string {
  const slug = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return RESERVED_SLUGS.has(slug) ? `${slug}-event` : slug;
}

function isRealDate(v: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(v + "T00:00:00Z");
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

/** Validate the admin event form. Returns clean column values or an error. */
export function parseEventInput(
  body: Record<string, unknown>
): { ok: true; fields: EventFields } | { ok: false; error: string } {
  const name = str(body.name, 80);
  const distance = str(body.distance, 40);
  const venue = str(body.venue, 80) || "Venue TBC";
  const location = str(body.location, 80) || "Location TBC";
  const status = str(body.status, 20);
  const dateTbc = body.dateTbc === true;
  const rawDate = str(body.date, 10);

  if (name.length < 3) return { ok: false, error: "Give the event a name" };
  if (!distance) return { ok: false, error: "Set the distance, for example 2K or 400m uphill" };
  if (!(EVENT_STATUSES as readonly string[]).includes(status)) {
    return { ok: false, error: "Pick a status" };
  }
  if (!dateTbc && !isRealDate(rawDate)) {
    return { ok: false, error: "Set a date, or tick Date TBC" };
  }
  const date = dateTbc ? DATE_TBC : rawDate;

  const fee = dollarsToCents(body.entryFee ?? 0, 1000);
  if (fee === null) return { ok: false, error: "Entry fee must be between $0 and $1,000" };

  let changeFee: number | null = null;
  if (body.changeFee !== undefined && body.changeFee !== null && body.changeFee !== "") {
    changeFee = dollarsToCents(body.changeFee, 1000);
    if (changeFee === null) return { ok: false, error: "Change fee must be between $0 and $1,000" };
  }

  const heatsEnabled = body.heatsEnabled === true;
  let firstHeat: string | null = null;
  let interval: number | null = null;
  let count: number | null = null;
  let capacity: number | null = null;
  let time = str(body.startTime, 40) || "Time TBC";

  if (heatsEnabled) {
    interval = intIn(body.heatIntervalMinutes, 1, 240);
    count = intIn(body.heatCount, 1, 50);
    capacity = intIn(body.heatCapacity, 1, 500);
    if (interval === null) return { ok: false, error: "Heat interval must be 1 to 240 minutes" };
    if (count === null) return { ok: false, error: "Number of heats must be 1 to 50" };
    if (capacity === null) return { ok: false, error: "Athletes per heat must be 1 to 500" };
    const fh = str(body.firstHeatTime, 5);
    if (fh) {
      if (!isValidClock(fh)) return { ok: false, error: "First heat time does not look right" };
      const [hh, mm] = fh.split(":").map(Number);
      if (hh * 60 + mm + (count - 1) * interval >= 1440) {
        return { ok: false, error: "Every heat has to start before midnight. Start earlier or run fewer heats." };
      }
      firstHeat = fh;
      time = formatClock(fh);
    } else {
      time = "Time TBC";
    }
  }

  if (status === "Open") {
    if (dateTbc) return { ok: false, error: "An event needs a date before it can open for bookings" };
    if (heatsEnabled && !firstHeat) {
      return { ok: false, error: "Set the first heat time before opening bookings" };
    }
  }

  const prizes = Array.isArray(body.prizes)
    ? (body.prizes as unknown[])
        .slice(0, 20)
        .map((p) => {
          const o = (p ?? {}) as Record<string, unknown>;
          return { label: str(o.label, 40), amount: str(o.amount, 40) };
        })
        .filter((p) => p.label && p.amount)
    : [];

  const bring = Array.isArray(body.whatToBring)
    ? (body.whatToBring as unknown[]).map((v) => str(v, 80)).filter(Boolean).slice(0, 20)
    : [];

  return {
    ok: true,
    fields: {
      name,
      distance,
      date,
      time,
      venue,
      location,
      status,
      entry_fee_cents: fee,
      description: str(body.description, 1500) || null,
      check_in: str(body.checkIn, 600) || null,
      what_to_bring: bring.length ? JSON.stringify(bring) : null,
      prizes: prizes.length ? JSON.stringify(prizes) : null,
      first_heat_time: firstHeat,
      heat_interval_minutes: interval,
      heat_count: count,
      heat_capacity: capacity,
      change_fee_cents: changeFee,
      is_test: body.isTest === true ? 1 : 0,
    },
  };
}
