/**
 * Event dates are calendar days. A date that has not been locked in yet is
 * stored as DATE_TBC so it sorts after every real date and never counts as
 * past; every place a date is shown goes through these helpers so "Date TBC"
 * renders consistently.
 */
export const DATE_TBC = "9999-12-31";

export function isDateTbc(date: string | null | undefined): boolean {
  return !date || date >= "9999-01-01";
}

function asDate(date: string) {
  return new Date(date + "T00:00:00");
}

export type DateStyle = "long" | "medium" | "short" | "compact";

/**
 * long:    Tuesday 1 September 2026
 * medium:  Tuesday 1 September
 * short:   Tue 1 Sep 2026
 * compact: 1 Sep 2026
 */
export function formatEventDate(
  date: string | null | undefined,
  style: DateStyle = "long"
): string {
  if (isDateTbc(date)) return "Date TBC";
  const d = asDate(date as string);
  switch (style) {
    case "medium":
      return d.toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long" });
    case "short":
      return d.toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
    case "compact":
      return d.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
    default:
      return d.toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  }
}

/** Parts for the stacked date block on cards: TUE / 01 / SEP. */
export function dateParts(date: string | null | undefined): {
  weekday: string;
  day: string;
  month: string;
  tbc: boolean;
} {
  if (isDateTbc(date)) return { weekday: "DATE", day: "TBC", month: "", tbc: true };
  const d = asDate(date as string);
  return {
    weekday: d.toLocaleDateString("en-AU", { weekday: "short" }).toUpperCase(),
    day: d.toLocaleDateString("en-AU", { day: "2-digit" }),
    month: d.toLocaleDateString("en-AU", { month: "short" }).toUpperCase(),
    tbc: false,
  };
}
