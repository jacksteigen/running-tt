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
