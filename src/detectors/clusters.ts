import type { EngineConfig, Severity, VoteEvent } from "../types.js";
import { choiceKey } from "../choices.js";

export interface Cluster {
  kind: "sybil" | "collusion";
  /** Stable key: sorted voter list — used to dedupe across ingests. */
  key: string;
  voters: string[];
  size: number;
  score: number;
  severity: Severity;
  reasons: string[];
  vpShare: number;
  timestampRange: [number, number];
}

const SYBIL_SEVERITY: Severity[] = ["none", "moderate", "strong", "extreme"];

/**
 * Sybil burst detection over the trailing time window ending at the newest
 * event. Scores: timestamp burst, identical choice, suspiciously similar VP
 * (coefficient of variation), rounded VP values.
 *
 * Design notes:
 * - CV (std/mean) rather than absolute similarity, so it scales with VP size.
 * - Wallet-age signal deferred — needs chain data the event stream lacks.
 */
export function detectSybilAt(
  votes: readonly VoteEvent[],
  cfg: EngineConfig,
): Cluster | null {
  const latest = votes[votes.length - 1];
  if (!latest) return null;

  const windowStart = latest.timestamp - cfg.sybilWindowSeconds;
  const window = votes.filter((v) => v.timestamp >= windowStart);
  if (window.length < cfg.sybilMinClusterSize) return null;

  let score = 0;
  const reasons: string[] = [];

  // Signal 1: timestamp burst (given).
  score += 1;
  reasons.push(
    `timestamp burst: ${window.length} wallets within ${cfg.sybilWindowSeconds}s`,
  );

  // Signal 2: identical vote choice across the burst.
  const keys = new Set(window.map((v) => choiceKey(v.choice)));
  if (keys.size === 1) {
    score += 1;
    reasons.push("identical vote choice across cluster");
  }

  // Signal 3: suspiciously similar VP (coefficient of variation).
  const weights = window.map((v) => v.weight);
  const mean = weights.reduce((a, b) => a + b, 0) / weights.length;
  const std = Math.sqrt(
    weights.reduce((a, b) => a + (b - mean) ** 2, 0) / weights.length,
  );
  if (mean > 0 && std / mean < 0.05) {
    score += 1;
    reasons.push(`suspiciously similar VP (std/mean = ${(std / mean).toFixed(3)})`);
  }

  // Signal 4: rounded VP values (integers above 1).
  const rounded = weights.filter((w) => w > 1 && w % 1 === 0).length;
  if (rounded >= cfg.sybilMinClusterSize) {
    score += 1;
    reasons.push(`${rounded} wallets with rounded VP values`);
  }

  if (score < 2) return null; // require at least 2 signals

  const severity = SYBIL_SEVERITY[Math.min(score - 1, 3)] as Severity;
  const voters = [...new Set(window.map((v) => v.voter))].sort();
  const total = votes.reduce((a, v) => a + v.weight, 0);
  const minTs = Math.min(...window.map((v) => v.timestamp));

  return {
    kind: "sybil",
    // Keyed by burst start so a growing burst updates rather than re-fires.
    key: `burst@${minTs}`,
    voters,
    size: window.length,
    score,
    severity,
    reasons,
    vpShare: total > 0 ? weights.reduce((a, b) => a + b, 0) / total : 0,
    timestampRange: [
      minTs,
      Math.max(...window.map((v) => v.timestamp)),
    ],
  };
}

/**
 * Collusion burst detection: identical normalised choices in the trailing
 * window ending at the newest event. Vote-type aware via choiceKey — ranked
 * orderings compare exactly, approval sets ignore order, weighted ballots are
 * tolerance-bucketed.
 *
 * Signal 3 deliberately REWARDS spread-out clusters ("rainbow attack"):
 * colluders who know about burst detection space their votes; an identical
 * ranking shared across a long window is itself suspicious.
 */
export function detectCollusionAt(
  votes: readonly VoteEvent[],
  cfg: EngineConfig,
): Cluster | null {
  const latest = votes[votes.length - 1];
  if (!latest) return null;

  const latestKey = choiceKey(latest.choice, {
    weightedTolerance: cfg.weightedTolerance,
  });
  const windowStart = latest.timestamp - cfg.collusionWindowSeconds;
  const window = votes.filter(
    (v) =>
      v.timestamp >= windowStart &&
      choiceKey(v.choice, { weightedTolerance: cfg.weightedTolerance }) ===
        latestKey,
  );
  if (window.length < cfg.collusionMinClusterSize) return null;

  const total = votes.reduce((a, v) => a + v.weight, 0);
  let score = 0;
  const reasons: string[] = [];

  // Signal 1: burst of identical choices (given).
  score += 1;
  reasons.push(
    `choice burst: ${window.length} identical ballots within ${cfg.collusionWindowSeconds}s`,
  );

  // Signal 2: cluster holds significant VP.
  const clusterVp = window.reduce((a, v) => a + v.weight, 0);
  const vpShare = total > 0 ? clusterVp / total : 0;
  if (vpShare >= cfg.collusionVpShareThreshold) {
    score += 1;
    reasons.push(`cluster holds ${(vpShare * 100).toFixed(1)}% of total VP`);
  }

  // Signal 3: spread out in time — possible deliberate evasion.
  const spread =
    Math.max(...window.map((v) => v.timestamp)) -
    Math.min(...window.map((v) => v.timestamp));
  if (spread > 60) {
    score += 1;
    reasons.push(`votes spread over ${spread}s — possible evasion`);
  }

  const severity: Severity =
    score >= 3 ? "strong" : score >= 2 ? "moderate" : "none";
  if (severity === "none") return null;

  const voters = [...new Set(window.map((v) => v.voter))].sort();
  const minTs = Math.min(...window.map((v) => v.timestamp));

  return {
    kind: "collusion",
    // Keyed by choice + burst start so a growing burst updates, not re-fires.
    key: `${latestKey}@${minTs}`,
    voters,
    size: window.length,
    score,
    severity,
    reasons,
    vpShare,
    timestampRange: [
      minTs,
      Math.max(...window.map((v) => v.timestamp)),
    ],
  };
}
