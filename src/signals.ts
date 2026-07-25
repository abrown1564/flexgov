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
