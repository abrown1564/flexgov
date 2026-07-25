import type { VoteType } from "./types.js";

/**
 * Voting-type vulnerability matrix.
 *
 * The same signal can mean abuse under one voting type and normal behaviour
 * under another: many identical single-choice ballots are expected, but many
 * identical full rankings are suspicious. So detection must be voting-type
 * aware. This matrix is the single source of truth for which vulnerabilities —
 * and therefore which detectors — apply to each type.
 *
 * `detectors` names the engine mechanisms that observe each vulnerability;
 * the engine consults `detectorsApply()` below to decide what to run.
 * Working draft (2-3 rows per type), mirrored in PROBLEM_STATEMENT.md.
 */
export interface VulnerabilityRow {
  vulnerability: string;
  /** Which engine detector(s) observe this vulnerability. */
  detectors: DetectorName[];
}

export type DetectorName =
  | "whale"
  | "quorum"
  | "turnout"
  | "late"
  | "sybil"
  | "collusion";

export const VULNERABILITY_MATRIX: Record<VoteType, VulnerabilityRow[]> = {
  single: [
    { vulnerability: "Whale decides outright", detectors: ["whale"] },
    { vulnerability: "Quorum capture (buy just enough)", detectors: ["quorum"] },
    { vulnerability: "Late acquisition", detectors: ["late"] },
  ],
  basic: [
    { vulnerability: "Whale dominance", detectors: ["whale"] },
    { vulnerability: "Quorum padding via Abstain", detectors: ["quorum", "turnout"] },
    { vulnerability: "Late influence", detectors: ["late"] },
  ],
  approval: [
    { vulnerability: "Bloc voting — identical approval sets", detectors: ["collusion"] },
    { vulnerability: "Sybil padding a slate", detectors: ["sybil"] },
    { vulnerability: "Whale approves its own slate", detectors: ["whale"] },
  ],
  ranked: [
    { vulnerability: "Coordinated identical rankings (incl. spread-out 'rainbow')", detectors: ["collusion"] },
    { vulnerability: "Whale first-preference dominance", detectors: ["whale"] },
    { vulnerability: "Sybil cluster, identical orderings", detectors: ["sybil"] },
  ],
  weighted: [
    { vulnerability: "Near-identical weight distributions (collusion)", detectors: ["collusion"] },
    { vulnerability: "Whale's split still dominates", detectors: ["whale"] },
  ],
  quadratic: [
    { vulnerability: "Sybil splitting to beat the square-root dampening", detectors: ["sybil"] },
    { vulnerability: "Coordinated identical ballots", detectors: ["collusion"] },
  ],
};

/**
 * True if a given detector applies to a voting type per the matrix.
 * Used to gate the collusion detector: identical "For" votes under single/basic
 * are ordinary, so collusion should not fire there.
 */
export function detectorApplies(voteType: VoteType, detector: DetectorName): boolean {
  return VULNERABILITY_MATRIX[voteType].some((row) =>
    row.detectors.includes(detector),
  );
}
