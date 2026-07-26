/** Pure signal math. No state — callers pass the accumulated votes. */

/**
 * Gini coefficient of a set of non-negative values.
 * 0 = perfect equality, ->1 = total concentration.
 */
export function gini(values: readonly number[]): number {
  const n = values.length;
  if (n === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  let sum = 0;
  let weighted = 0;
  for (let i = 0; i < n; i++) {
    const v = sorted[i] as number;
    sum += v;
    weighted += (i + 1) * v;
  }
  if (sum === 0) return 0;
  return (2 * weighted) / (n * sum) - (n + 1) / n;
}

/** Share of total held by the single largest value. */
export function topShare(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const total = values.reduce((a, b) => a + b, 0);
  if (total === 0) return 0;
  return Math.max(...values) / total;
}

/** Share of total held by the k largest values. */
export function topKShare(values: readonly number[], k: number): number {
  if (values.length === 0) return 0;
  const total = values.reduce((a, b) => a + b, 0);
  if (total === 0) return 0;
  const top = [...values].sort((a, b) => b - a).slice(0, k);
  return top.reduce((a, b) => a + b, 0) / total;
}

/**
 * Neutral timing baseline for exact-second collisions.
 *
 * If N votes were independently and uniformly distributed across T seconds,
 * the chance that a given vote shares its second with at least one other vote
 * is `1 - (1 - 1/T)^(N - 1)`. Real voting is not uniform, so this is a simple
 * comparison baseline rather than a Sybil threshold or proof of coordination.
 */
export function expectedDuplicateTimestampRatio(
  voteCount: number,
  windowSeconds: number,
): number | null {
  if (voteCount < 2 || windowSeconds <= 0) return null;
  return 1 - Math.pow(1 - 1 / windowSeconds, voteCount - 1);
}

/**
 * Sensitivity scenarios for increasingly concentrated daily participation.
 * These do not infer voters' locations; they show how the simple collision
 * baseline changes if the same proposal activity is compressed into fewer
 * active hours per day.
 */
export function duplicateTimestampSensitivity(
  voteCount: number,
  windowSeconds: number,
): Array<{ activeHoursPerDay: number; expectedRatio: number }> {
  if (voteCount < 2 || windowSeconds <= 0) return [];
  const proposalDays = windowSeconds / 86_400;
  return [24, 16, 12, 8].map((activeHoursPerDay) => ({
    activeHoursPerDay,
    expectedRatio:
      expectedDuplicateTimestampRatio(
        voteCount,
        proposalDays * activeHoursPerDay * 3_600,
      ) ?? 0,
  }));
}
