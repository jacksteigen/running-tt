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

/**
 * Derive the display status for an event. Once the event's date has passed
 * it always renders as "Completed" regardless of the stored status, so the
 * UI never needs a manual state flip after each event.
 */
export function displayStatus(dbStatus: string, dateISO: string): string {
  if (dateISO < todayInMelbourne()) return "Completed";
  return dbStatus;
}
