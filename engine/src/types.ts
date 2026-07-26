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

/**
 * The voting type declared at the proposal level. This is the source of truth
 * for which detectors apply (see the vulnerability matrix in matrix.ts). Ballot
 * shape alone cannot distinguish some of these (e.g. single vs. basic, or
 * weighted vs. quadratic share the same shape), which is why the proposal must
 * declare it; inferVoteType() is only a fallback.
 */
export type VoteType =
  | "single" // pick one option, token-weighted
  | "basic" // For / Against / Abstain (Snapshot "basic", Governor bravo)
  | "approval" // pick many; each selected option gets the voter's full weight
  | "ranked" // full ordering (instant-runoff)
  | "weighted" // split weight across options
  | "quadratic"; // weight counted as its square root

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
  /**
   * Declared voting type. Determines which detectors apply (matrix.ts). If
   * omitted, the engine falls back to inferring it from the first ballot's
   * shape — less reliable, so prefer setting this from platform metadata.
   */
  voteType?: VoteType;
  /** Known DAO membership (wallets eligible/known), for turnout signals. */
  memberCount?: number;
  /** Total token supply (same unit as VoteEvent.weight), for quorum. */
  totalSupply?: number;
  /** Quorum as a fraction of totalSupply (e.g. BonkDAO's 0.01). */
  quorumFraction?: number;
  /**
   * Direct quorum threshold in the same unit as VoteEvent.weight.
   *
   * Governor contracts often publish an authoritative fixed threshold without
   * exposing the historical total-supply denominator needed to reconstruct it.
   * Prefer this field when the indexed contract supplies that threshold.
   */
  quorumTarget?: number;
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
    | "late"
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
  /**
   * Share of wallets that share an exact cast timestamp with at least one
   * other wallet. This is a temporal-coordination signal, not a Sybil verdict;
   * large or time-concentrated elections can produce natural collisions. [0,1]
   */
  dupTimestampRatio: number;
  /** Proposal voting-window duration in seconds, when start/end are usable. */
  votingWindowSeconds: number | null;
  /** Average votes per day across the declared proposal window. */
  averageVotesPerDay: number | null;
  /** Average votes per hour across the declared proposal window. */
  averageVotesPerHour: number | null;
  /** Average votes per minute across the declared proposal window. */
  averageVotesPerMinute: number | null;
  /**
   * Expected duplicate-timestamp ratio under a uniform independent-arrival
   * baseline. This is a comparator, not a Sybil threshold.
   */
  expectedDupTimestampRatio: number | null;
  /** Observed duplicate-timestamp ratio minus the uniform baseline. */
  dupTimestampExcess: number | null;
  /** Observed / expected duplicate-timestamp ratio. */
  dupTimestampLift: number | null;
  /**
   * Expected collision rates under simple daily activity-window scenarios.
   * These are sensitivity references, not claims about voter locations.
   */
  dupTimestampSensitivity: Array<{
    activeHoursPerDay: number;
    expectedRatio: number;
  }>;
  /** Smallest number of wallets whose combined weight is >=50% of cast weight. */
  walletsFor50Pct: number;
  /**
   * Share of total cast weight that arrived in the final `lateWindowFraction`
   * of the voting window. High values mean voting power showed up late — a
   * proxy for late influence. null when the window ([start,end]) is unusable.
   * NOTE: this measures late *voting*, not late token *acquisition*; the engine
   * only sees votes, so it cannot see tokens bought before the snapshot.
   */
  lateWeightShare: number | null;
}

/** Result of one voting rule applied to the votes so far. */
export interface RuleOutcome {
  rule: CounterfactualRule;
  /** Tally per normalised choice key. */
  tally: Record<string, number>;
  /** Winning choice key, or null if no votes / exact tie. */
  winner: string | null;
  /** Gini of the transformed ballot weights under this rule (fairness impact). */
  gini: number;
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
  /**
   * Tiered rule selection:
   * extreme whale -> 1W1V; sybil/collusion evidence or dup-timestamp burst
   * -> QV; otherwise the token rule stands.
   */
  recommendedRule: CounterfactualRule;
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
  /**
   * Legacy duplicate-timestamp comparison threshold (default 0.20), retained
   * for configuration compatibility and reporting. It no longer selects QV by
   * itself; a rule recommendation requires corroborated cluster evidence.
   */
  dupTsRatioThreshold: number;
  /**
   * Late-influence window: the final fraction of the voting window that counts
   * as "late" (default 0.10 = last 10% of [start,end]).
   */
  lateWindowFraction: number;
  /**
   * Late-influence alert threshold: fraction of total weight arriving in the
   * late window that triggers an alert (default 0.30 = 30% of all weight).
   */
  lateWeightShareThreshold: number;
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
  dupTsRatioThreshold: 0.2,
  lateWindowFraction: 0.1,
  lateWeightShareThreshold: 0.3,
};
