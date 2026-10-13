import { prizeToCents, type PrizeSlot } from "@/lib/racetime";

// Race categories and how an event pays its prize money. An athlete races in
// one category, set on their profile. An event pays its prize places either
// down the overall order, or once for each category.

export const RACE_CATEGORIES = ["women", "men"] as const;
export type RaceCategory = (typeof RACE_CATEGORIES)[number];

/** "Women", "Men": board titles, chips and form options. */
export const CATEGORY_LABEL: Record<RaceCategory, string> = {
  women: "Women",
  men: "Men",
};

/** Singular, for a place line: "1st woman", "3rd man". */
export const CATEGORY_NOUN: Record<RaceCategory, string> = {
  women: "woman",
  men: "man",
};

/** Possessive, for running copy: "the women's prize money". */
export const CATEGORY_POSSESSIVE: Record<RaceCategory, string> = {
  women: "women's",
  men: "men's",
};

export function isRaceCategory(v: unknown): v is RaceCategory {
  return typeof v === "string" && (RACE_CATEGORIES as readonly string[]).includes(v);
}

/** A stored or submitted value as a category, or null when unset or unknown. */
export function toRaceCategory(v: unknown): RaceCategory | null {
  return isRaceCategory(v) ? v : null;
}

export const PRIZE_SPLITS = ["overall", "category"] as const;
/**
 * "overall": prize places are paid down the overall order.
 * "category": the same prize places are paid once in each race category.
 */
export type PrizeSplit = (typeof PRIZE_SPLITS)[number];

export function isPrizeSplit(v: unknown): v is PrizeSplit {
  return typeof v === "string" && (PRIZE_SPLITS as readonly string[]).includes(v);
}

/** A stored value as a prize split. Anything unknown pays overall. */
export function toPrizeSplit(v: unknown): PrizeSplit {
  return isPrizeSplit(v) ? v : "overall";
}

/** 1st, 2nd, 3rd, 4th, 11th, 12th, 13th, 21st, 22nd, 101st. */
export function ordinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

/**
 * The cash in an event's purse, in cents. Non-cash prizes count as nothing.
 * A purse paid per category pays every place once in each category.
 */
export function purseCents(prizes: PrizeSlot[], split: PrizeSplit): number {
  const once = prizes.reduce((sum, p) => sum + prizeToCents(p.amount), 0);
  return split === "category" ? once * RACE_CATEGORIES.length : once;
}

/**
 * The place that counts for a result: the category place when the event pays
 * per category, otherwise the overall place. Use it for wins, podiums and the
 * big number beside a result. An athlete with no category in a race paid by
 * category has no place that counts, so this is null: never a win or podium.
 */
export function placeFor(row: {
  rank: number;
  category_rank?: number | null;
  prize_split?: string | null;
}): number | null {
  return toPrizeSplit(row.prize_split) === "category" ? (row.category_rank ?? null) : row.rank;
}
