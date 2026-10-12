/**
 * Race time parsing and formatting. Accepts the shorthand people actually
 * type at the finish line: "4:32.10", "4:32", "72.5", "1:02:33".
 */
export function parseTimeToSeconds(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const parts = trimmed.split(":");
  if (parts.length > 3) return null;

  let seconds = 0;
  for (const part of parts) {
    if (!/^\d*\.?\d*$/.test(part) || part === "" || part === ".") return null;
    const value = parseFloat(part);
    if (!Number.isFinite(value)) return null;
    seconds = seconds * 60 + value;
  }

  if (seconds <= 0 || seconds > 24 * 60 * 60) return null;
  return Math.round(seconds * 100) / 100;
}

/** Anything slower than this needs an explicit confirm before it is saved. */
export const LONG_TIME_SECONDS = 60 * 60;

/**
 * Stopwatches show hundredths after a colon, so "6:03:31" usually means six
 * minutes 3.31 seconds, not six hours. Returns that reading when the input
 * has that shape, so the editor can offer it before a long time is saved.
 */
export function stopwatchReading(input: string): { seconds: number; display: string } | null {
  const m = input.trim().match(/^(\d{1,2}):(\d{2}):(\d{2})$/);
  if (!m) return null;
  const minutes = Number(m[1]);
  const secs = Number(m[2]);
  const hundredths = Number(m[3]);
  if (secs > 59) return null;
  const seconds = Math.round((minutes * 60 + secs + hundredths / 100) * 100) / 100;
  if (seconds <= 0) return null;
  return { seconds, display: formatSeconds(seconds) };
}

/** Render seconds the way results are read aloud: 4:32.10, or 1:02:33.40. */
export function formatSeconds(total: number): string {
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const secondsText = seconds.toFixed(2).padStart(5, "0");

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${secondsText}`;
  }
  return `${minutes}:${secondsText}`;
}

export interface PrizeSlot {
  label: string;
  amount: string;
}

export function parsePrizes(raw: string | null): PrizeSlot[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (p) =>
          p && typeof p.label === "string" && typeof p.amount === "string"
      )
      .slice(0, 20);
  } catch {
    return [];
  }
}

/** "$100" or "100" to cents. Non-numeric prizes (a voucher, kit) give 0. */
export function prizeToCents(amount: string): number {
  const match = amount.replace(/,/g, "").match(/\d+(\.\d+)?/);
  if (!match) return 0;
  return Math.round(parseFloat(match[0]) * 100);
}
