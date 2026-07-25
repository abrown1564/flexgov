import type { Choice, VoteType } from "./types.js";

/** Infer the vote type from a ballot's shape. */
export function inferVoteType(choice: Choice): VoteType {
  if (Array.isArray(choice)) return choice.length > 1 ? "ranked" : "single";
  if (typeof choice === "object" && choice !== null) return "weighted";
  return "single";
}

/**
 * Normalise a choice into a stable, comparable string key.
 *
 * - ranked:   order preserved — "1>2>3"
 * - approval: sorted so [A,B] === [B,A] — "A+B"
 * - weighted: weights bucketed by tolerance so {A:.51,B:.49} ~ {A:.52,B:.48}
 * - single:   the choice itself
 *
 * `voteTypeHint` lets callers force approval semantics for arrays (Snapshot
 * distinguishes ranked vs approval at the proposal level, not the ballot).
 */
export function choiceKey(
  choice: Choice,
  opts: { voteTypeHint?: VoteType; weightedTolerance?: number } = {},
): string {
  const tol = opts.weightedTolerance ?? 0.05;
  const type = opts.voteTypeHint ?? inferVoteType(choice);

  if (Array.isArray(choice)) {
    const items = choice.map(String);
    if (type === "approval") return [...items].sort().join("+");
    if (items.length === 1) return items[0] as string;
    return items.join(">");
  }
  if (typeof choice === "object" && choice !== null) {
    return Object.entries(choice)
      .map(([k, v]) => [k, Math.round(v / tol) * tol] as const)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}:${v.toFixed(2)}`)
      .join("|");
  }
  return String(choice);
}

/**
 * The choice a ballot contributes to a head-to-head tally.
 * Ranked ballots contribute their first preference; approval/weighted ballots
 * are tallied per-option by the counterfactual layer instead.
 */
export function primaryChoice(choice: Choice): string {
  if (Array.isArray(choice)) return String(choice[0] ?? "");
  if (typeof choice === "object" && choice !== null) {
    const entries = Object.entries(choice).sort((a, b) => b[1] - a[1]);
    return entries[0]?.[0] ?? "";
  }
  return String(choice);
}
