/**
 * Derive the display status for an event. Once the event's date has passed
 * we always render it as "Completed" regardless of the stored status, so the
 * UI doesn't need manual state flips after each event.
 */
export function displayStatus(dbStatus: string, dateISO: string): string {
  const today = new Date().toISOString().slice(0, 10);
  if (dateISO < today) return "Completed";
  return dbStatus;
}
