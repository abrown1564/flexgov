import type {
  CounterfactualRule,
  RuleOutcome,
  VoteEvent,
} from "./types.js";
import { primaryChoice } from "./choices.js";
import { gini } from "./signals.js";

/**
 * Counterfactual tallies: what the outcome would be under alternative voting
 * rules, given the same ballots.
 *
 * - 1T1V:     weight as cast (the actual rule for token-weighted DAOs)
 * - QV:       sqrt(weight) — quadratic dampening of concentration
 * - 1W1V:     one wallet, one vote (no personhood claim — see whitepaper §6)
 * - GININORM: weight^(1 - G) where G is the Gini of weights cast so far.
 *             Dampening scales with measured inequality: at G=0 it is 1T1V,
 *             as G->1 it approaches 1W1V.
 *
 * MVP scope: ballots are tallied head-to-head via their primary choice
 * (ranked ballots contribute first preference). Per-option approval/weighted
 * tallying is a documented extension.
 */
export function computeOutcomes(votes: readonly VoteEvent[]): RuleOutcome[] {
  const g = gini(votes.map((v) => v.weight));
  const rules: Array<[CounterfactualRule, (w: number) => number]> = [
    ["1T1V", (w) => w],
    ["QV", (w) => Math.sqrt(Math.max(w, 0))],
    ["1W1V", () => 1],
    ["GININORM", (w) => Math.pow(Math.max(w, 0), 1 - g)],
  ];

  return rules.map(([rule, fn]) => {
    const tally: Record<string, number> = {};
    for (const v of votes) {
      const key = primaryChoice(v.choice);
      tally[key] = (tally[key] ?? 0) + fn(v.weight);
    }
    return { rule, tally, winner: winnerOf(tally) };
  });
}

function winnerOf(tally: Record<string, number>): string | null {
  const entries = Object.entries(tally);
  if (entries.length === 0) return null;
  entries.sort((a, b) => b[1] - a[1]);
  const first = entries[0];
  const second = entries[1];
  if (!first) return null;
  if (second && second[1] === first[1]) return null; // exact tie
  return first[0];
}

/**
 * Advisory robustness of the actual (1T1V) outcome across rules:
 * - robust:         every rule agrees on the winner
 * - contested:      the 1T1V winner still wins under at least half the alternatives
 * - rule-dependent: the 1T1V winner loses under most alternative rules
 */
export function classifyRobustness(
  outcomes: readonly RuleOutcome[],
): "robust" | "contested" | "rule-dependent" | "n/a" {
  const actual = outcomes.find((o) => o.rule === "1T1V");
  if (!actual || actual.winner === null) return "n/a";
  const alternatives = outcomes.filter((o) => o.rule !== "1T1V");
  if (alternatives.length === 0) return "n/a";
  const agree = alternatives.filter((o) => o.winner === actual.winner).length;
  if (agree === alternatives.length) return "robust";
  if (agree >= alternatives.length / 2) return "contested";
  return "rule-dependent";
}
