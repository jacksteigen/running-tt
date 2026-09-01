/**
 * Age groups are worked out from date of birth on the day of the event, in
 * ten-year bands. This is the one place to change if the bands ever move.
 */
export const AGE_GROUPS = [
  "Under 20",
  "20-29",
  "30-39",
  "40-49",
  "50-59",
  "60-69",
  "70+",
] as const;

export function ageOn(dobISO: string, onISO: string): number | null {
  const dob = new Date(dobISO + "T00:00:00Z");
  const on = new Date(onISO + "T00:00:00Z");
  if (Number.isNaN(dob.getTime()) || Number.isNaN(on.getTime())) return null;

  let age = on.getUTCFullYear() - dob.getUTCFullYear();
  const beforeBirthday =
    on.getUTCMonth() < dob.getUTCMonth() ||
    (on.getUTCMonth() === dob.getUTCMonth() &&
      on.getUTCDate() < dob.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age;
}

export function ageGroupFor(age: number): string {
  if (age < 20) return "Under 20";
  if (age >= 70) return "70+";
  const lower = Math.floor(age / 10) * 10;
  return `${lower}-${lower + 9}`;
}

export function ageGroupOn(
  dobISO: string | null | undefined,
  onISO: string
): string | null {
  if (!dobISO) return null;
  const age = ageOn(dobISO, onISO);
  if (age === null || age < 0) return null;
  return ageGroupFor(age);
}

/** A plausible date of birth for a competing athlete. */
export function isValidDob(dobISO: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dobISO)) return false;
  const age = ageOn(dobISO, new Date().toISOString().slice(0, 10));
  return age !== null && age >= 5 && age <= 110;
}
