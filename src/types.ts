/**
 * Core types for the FlexGov engine.
 *
 * The engine is a fold over an ordered stream of VoteEvents. Each ingested
 * event produces a full Snapshot: signals, alerts, counterfactuals, and an
 * advisory classification. Replay mode and Live mode differ only in where
 * the events come from.
 */

/**
 * A ballot choice. Mirrors the vote types seen on Snapshot/Governor/Realms:
 * - single choice:   number | string          e.g. 1, "For"
 * - ranked choice:   array (full ordering)    e.g. [3, 1, 2]
 * - approval:        array (unordered set)    e.g. ["A", "C"]
 * - weighted:        record of weights        e.g. { "A": 0.6, "B": 0.4 }
 */
export type Choice =
  | number
  | string
  | Array<number | string>
  | Record<string, number>;

export type VoteType = "single" | "ranked" | "approval" | "weighted";

/** One governance vote landing on a proposal. */
export interface VoteEvent {
  voter: string;
  /** Resolved voting power at cast time (e.g. token-weighted VP). */
  weight: number;
  choice: Choice;
  /** Unix seconds. Events must be ingested in non-decreasing timestamp order. */
  timestamp: number;
}

/** Static facts about the proposal being monitored. */
export interface ProposalContext {
  id: string;
  title?: string;
  /** Unix seconds — voting window. */
  start: number;
  end: number;
  /** Known DAO membership (wallets eligible/known), for turnout signals. */
  memberCount?: number;
  /** Total token supply (same unit as VoteEvent.weight), for quorum. */
  totalSupply?: number;
  /** Quorum as a fraction of totalSupply (e.g. BonkDAO's 0.01). */
  quorumFraction?: number;
  /** Human-readable choice labels, if known. */
  choices?: string[];
}

export type Severity = "none" | "moderate" | "strong" | "extreme";

export const SEVERITY_ORDER: readonly Severity[] = [
  "none",
  "moderate",
  "strong",
  "extreme",
];

export function maxSeverity(a: Severity, b: Severity): Severity {
  return SEVERITY_ORDER.indexOf(a) >= SEVERITY_ORDER.indexOf(b) ? a : b;
}

/** A threshold crossing / detection, pinned to the event that fired it. */
export interface Alert {
  /** Stable id so the same alert never fires twice (UI pins it once). */
  id: string;
  signal:
    | "whale"
    | "turnout"
    | "quorum"
    | "sybil"
    | "collusion"
    | "policy";
  severity: Severity;
  message: string;
  /** Timestamp of the event that fired this alert (unix seconds). */
  at: number;
  /** 1-based index of the vote event that fired this alert. */
  voteIndex: number;
}

/** Continuous signals recomputed on every ingested event. */
export interface Signals {
  /** Largest single voter's share of weight cast so far. [0,1] */
  whaleShare: number;
  /** Top-3 voters' share of weight cast so far. [0,1] */
  top3Share: number;
  /** Gini coefficient of per-voter weights cast so far. [0,1] */
  gini: number;
  /** Distinct voters so far / memberCount (if known). */
  turnout: number | null;
  /** Weight cast so far / (totalSupply * quorumFraction). >=1 means met. */
  quorumProgress: number | null;
  /** Distinct voters so far. */
  voterCount: number;
  /** Sum of weight cast so far. */
  totalWeight: number;
}

/** Result of one voting rule applied to the votes so far. */
export interface RuleOutcome {
  rule: CounterfactualRule;
  /** Tally per normalised choice key. */
  tally: Record<string, number>;
  /** Winning choice key, or null if no votes / exact tie. */
  winner: string | null;
}

export type CounterfactualRule =
  | "1T1V" // token-weighted (the actual rule for most DAOs)
  | "QV" // quadratic: sqrt(weight)
  | "1W1V" // one wallet one vote
  | "GININORM"; // weight^(1 - gini): dampens concentration by measured inequality

/**
 * Advisory robustness of the current leading outcome across rules:
 * - robust:         all rules agree on the winner
 * - contested:      rules disagree, but the actual rule's winner still wins a majority of rules
 * - rule-dependent: the actual rule's winner loses under most alternative rules
 */
export type Robustness = "robust" | "contested" | "rule-dependent" | "n/a";

/** Everything the UI needs after each event. */
export interface Snapshot {
  proposal: ProposalContext;
  voteIndex: number;
  lastEvent: VoteEvent | null;
  signals: Signals;
  /** Alerts fired by THIS event only (UI appends). */
  newAlerts: Alert[];
  /** All alerts fired so far. */
  alerts: Alert[];
  severity: Severity;
  outcomes: RuleOutcome[];
  robustness: Robustness;
  /** True once the pre-authorised escalation policy would have fired. */
  escalated: boolean;
}

export interface EngineConfig {
  /** Whale share triggering "extreme" (default 0.50). */
  whaleExtremeThreshold: number;
  /** Whale share triggering "moderate" (default 0.30). */
  whaleModerateThreshold: number;
  /** Top-3 share triggering "moderate" (default 0.70). */
  top3ModerateThreshold: number;
  /** Turnout below this when quorum is met => alert (default 0.01). */
  criticalTurnout: number;
  /** Sybil: seconds within which ballots form a burst (default 30). */
  sybilWindowSeconds: number;
  /** Sybil: minimum wallets in a burst worth scoring (default 3). */
  sybilMinClusterSize: number;
  /** Collusion: seconds within which identical choices form a burst (default 300). */
  collusionWindowSeconds: number;
  /** Collusion: minimum identical choices to flag (default 3). */
  collusionMinClusterSize: number;
  /** Collusion: cluster VP share that raises the score (default 0.10). */
  collusionVpShareThreshold: number;
  /** Weighted-vote comparison tolerance (default 0.05). */
  weightedTolerance: number;
}

export const DEFAULT_CONFIG: EngineConfig = {
  whaleExtremeThreshold: 0.5,
  whaleModerateThreshold: 0.3,
  top3ModerateThreshold: 0.7,
  criticalTurnout: 0.01,
  sybilWindowSeconds: 30,
  sybilMinClusterSize: 3,
  collusionWindowSeconds: 300,
  collusionMinClusterSize: 3,
  collusionVpShareThreshold: 0.1,
  weightedTolerance: 0.05,
};
