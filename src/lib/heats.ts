/**
 * Heat booking. An event with heats has a first heat time, an interval and a
 * count, and every heat holds the same number of athletes. Heats are derived
 * from those four numbers rather than stored, so moving the start time
 * shifts every heat at once.
 */

/** How long an unpaid checkout holds a spot. Stripe sessions expire at 31. */
export const HOLD_MINUTES = 35;

/** SQL predicate for an entry that is taking up a spot in a heat. */
export const OCCUPYING_SQL = `(status = 'confirmed' OR (status = 'pending' AND created_at > datetime('now', '-${HOLD_MINUTES} minutes')))`;

export interface HeatConfig {
  first_heat_time: string | null;
  heat_interval_minutes: number | null;
  heat_count: number | null;
  heat_capacity: number | null;
}

export interface Heat {
  number: number;
  offsetMinutes: number;
  /** 24h "HH:MM", or null while the start time is not set. */
  startTime: string | null;
  /** "5:45pm", or "Start + 45 min" while the start time is not set. */
  label: string;
  capacity: number;
}

export interface HeatAvailability extends Heat {
  booked: number;
  remaining: number;
  full: boolean;
}

export function hasHeats(e: Partial<HeatConfig> | null | undefined): boolean {
  return !!e && (e.heat_count ?? 0) > 0;
}

export function isValidClock(value: unknown): value is string {
  return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

/** "17:15" to "5:15pm". */
export function formatClock(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const suffix = h >= 12 ? "pm" : "am";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")}${suffix}`;
}

export function addMinutes(hhmm: string, minutes: number): string {
  const [h, m] = hhmm.split(":").map(Number);
  const total = (((h * 60 + m + minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function offsetLabel(offset: number): string {
  if (offset === 0) return "First heat";
  const h = Math.floor(offset / 60);
  const m = offset % 60;
  if (h === 0) return `Start + ${m} min`;
  return m === 0 ? `Start + ${h} hr` : `Start + ${h} hr ${m} min`;
}

export function buildHeats(e: HeatConfig): Heat[] {
  if (!hasHeats(e)) return [];
  const count = e.heat_count as number;
  const interval = e.heat_interval_minutes && e.heat_interval_minutes > 0 ? e.heat_interval_minutes : 15;
  const capacity = e.heat_capacity && e.heat_capacity > 0 ? e.heat_capacity : 10;
  const first = isValidClock(e.first_heat_time) ? e.first_heat_time : null;

  return Array.from({ length: count }, (_, i) => {
    const offsetMinutes = i * interval;
    const startTime = first ? addMinutes(first, offsetMinutes) : null;
    return {
      number: i + 1,
      offsetMinutes,
      startTime,
      label: startTime ? formatClock(startTime) : offsetLabel(offsetMinutes),
      capacity,
    };
  });
}

/** "Heat 4 · 5:45pm" or "Heat 4" when the start time is not set. */
export function heatLabel(e: HeatConfig, heatNumber: number | null | undefined): string {
  if (!heatNumber) return "";
  const heat = buildHeats(e).find((h) => h.number === heatNumber);
  return heat?.startTime ? `Heat ${heatNumber} · ${heat.label}` : `Heat ${heatNumber}`;
}

/** The time window the heats span, e.g. "5:00pm to 7:45pm". */
export function heatWindow(e: HeatConfig): string | null {
  const heats = buildHeats(e);
  if (!heats.length || !heats[0].startTime) return null;
  const last = heats[heats.length - 1];
  return heats.length === 1 ? heats[0].label : `${heats[0].label} to ${last.label}`;
}

export async function getHeatAvailability(
  db: D1Database,
  event: HeatConfig & { id: string }
): Promise<HeatAvailability[]> {
  const heats = buildHeats(event);
  if (!heats.length) return [];

  const counts = (await db
    .prepare(
      `SELECT heat_number, COUNT(*) as n FROM entries
       WHERE event_id = ? AND heat_number IS NOT NULL AND ${OCCUPYING_SQL}
       GROUP BY heat_number`
    )
    .bind(event.id)
    .all()) as unknown as { results: { heat_number: number; n: number }[] };

  const byHeat = new Map(counts.results.map((r) => [r.heat_number, r.n]));
  return heats.map((h) => {
    const booked = byHeat.get(h.number) ?? 0;
    const remaining = Math.max(0, h.capacity - booked);
    return { ...h, booked, remaining, full: remaining === 0 };
  });
}
