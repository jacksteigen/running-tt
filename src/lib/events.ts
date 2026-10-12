/**
 * Event dates are calendar days in Australia/Melbourne, where Running TT is
 * run from. Comparing against a UTC date would keep an evening event "open"
 * until the next morning, so every "is it today / has it passed" check goes
 * through here.
 */
export function todayInMelbourne(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Melbourne",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** The current Melbourne wall-clock time as "HH:MM", for race-day cutoffs. */
export function nowClockInMelbourne(): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Australia/Melbourne",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const h = parts.find((p) => p.type === "hour")?.value ?? "00";
  const m = parts.find((p) => p.type === "minute")?.value ?? "00";
  return `${h === "24" ? "00" : h}:${m}`;
}

/**
 * Derive the display status for an event. Once the event's date has passed
 * it always renders as "Completed" regardless of the stored status, so the
 * UI never needs a manual state flip after each event.
 */
export function displayStatus(dbStatus: string, dateISO: string): string {
  if (dateISO < todayInMelbourne()) return "Completed";
  return dbStatus;
}
