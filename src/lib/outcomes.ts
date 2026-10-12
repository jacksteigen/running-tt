/**
 * Non-finishing outcomes. These live on the entry, never in results, so a
 * DNF can never affect ranks, averages, prize money or personal bests.
 */
export const OUTCOMES = {
  dnf: { label: "DNF", name: "Did not finish" },
  dns: { label: "DNS", name: "Did not start" },
  dq: { label: "DQ", name: "Disqualified" },
} as const;

export type Outcome = keyof typeof OUTCOMES;

export function isOutcome(value: unknown): value is Outcome {
  return typeof value === "string" && value in OUTCOMES;
}

/** Outcomes shown on public leaderboards. DNS stays admin-only. */
export const PUBLIC_OUTCOMES: Outcome[] = ["dnf", "dq"];
