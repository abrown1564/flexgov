import type {
  Alert,
  EngineConfig,
  ProposalContext,
  Severity,
  Signals,
  Snapshot,
  VoteEvent,
  VoteType,
} from "./types.js";
import { DEFAULT_CONFIG, maxSeverity } from "./types.js";
import {
  duplicateTimestampSensitivity,
  expectedDuplicateTimestampRatio,
  gini,
  topKShare,
  topShare,
} from "./signals.js";
import { computeOutcomes, classifyRobustness } from "./counterfactuals.js";
import { inferVoteType } from "./choices.js";
import { detectorApplies } from "./matrix.js";
import {
  detectCollusionAt,
  detectSybilAt,
  type Cluster,
} from "./detectors/clusters.js";

export interface Engine {
  /** Feed one vote event (non-decreasing timestamps). Returns the new snapshot. */
  ingest(event: VoteEvent): Snapshot;
  /** Current snapshot without ingesting. */
  snapshot(): Snapshot;
}

/**
 * The engine is a fold: state accumulates, and every ingested event yields a
 * complete Snapshot. The Replay Player scrubs across snapshots; Live mode
 * ingests as the subgraph delivers new votes. Same code path.
 *
 * Advisory by default: `escalated` marks where a pre-authorised policy WOULD
 * have fired. The engine never claims enforcement authority (whitepaper §6.1).
 */
export function createEngine(
  proposal: ProposalContext,
  config: Partial<EngineConfig> = {},
): Engine {
  const cfg: EngineConfig = { ...DEFAULT_CONFIG, ...config };

  const votes: VoteEvent[] = [];
  const weightByVoter = new Map<string, number>();
  const votersByTimestamp = new Map<number, Set<string>>();
  const alerts: Alert[] = [];
  const firedAlertIds = new Set<string>();
  const seenClusterKeys = new Set<string>();
  let severity: Severity = "none";
  let escalated = false;
  let last: Snapshot = emptySnapshot(proposal);

  // Resolve the voting type once: prefer the proposal's declared type, else
  // infer from the first ballot's shape. This drives which detectors apply.
  let resolvedVoteType: VoteType | null = proposal.voteType ?? null;

  function fire(
    newAlerts: Alert[],
    id: string,
    partial: Omit<Alert, "id">,
  ): void {
    if (firedAlertIds.has(id)) return;
    firedAlertIds.add(id);
    const alert: Alert = { id, ...partial };
    alerts.push(alert);
    newAlerts.push(alert);
    severity = maxSeverity(severity, alert.severity);
  }

  function computeSignals(): Signals {
    const perVoter = [...weightByVoter.values()];
    const totalWeight = perVoter.reduce((a, b) => a + b, 0);
    const quorumTarget =
      proposal.totalSupply != null && proposal.quorumFraction != null
        ? proposal.totalSupply * proposal.quorumFraction
        : null;

    // Duplicate-timestamp Sybil proxy: wallets sharing an exact timestamp.
    let dupWallets = 0;
    for (const voters of votersByTimestamp.values()) {
      if (voters.size > 1) dupWallets += voters.size;
    }

    // Smallest wallet set controlling >=50% of cast weight.
    let walletsFor50Pct = 0;
    if (totalWeight > 0) {
      const desc = [...perVoter].sort((a, b) => b - a);
      let acc = 0;
      for (const w of desc) {
        acc += w;
        walletsFor50Pct += 1;
        if (acc >= totalWeight / 2) break;
      }
    }

    // Late-influence: share of total cast weight that arrived in the final
    // `lateWindowFraction` of the voting window. Needs a usable window and
    // some weight; otherwise null.
    let lateWeightShare: number | null = null;
    const windowLength = proposal.end - proposal.start;
    if (windowLength > 0 && totalWeight > 0) {
      const lateCutoff = proposal.end - windowLength * cfg.lateWindowFraction;
      const lateWeight = votes
        .filter((v) => v.timestamp >= lateCutoff)
        .reduce((a, v) => a + v.weight, 0);
      lateWeightShare = lateWeight / totalWeight;
    }

    // Recompute the timing comparison as the live/replay stream grows. These
    // baselines explain whether a collision rate is surprising under several
    // activity-window assumptions; they do not turn timing into identity proof.
    const votingWindowSeconds =
      proposal.end > proposal.start ? proposal.end - proposal.start : null;
    const expectedDupTimestampRatio =
      votingWindowSeconds != null
        ? expectedDuplicateTimestampRatio(
            weightByVoter.size,
            votingWindowSeconds,
          )
        : null;
    const dupTimestampRatio =
      weightByVoter.size > 0 ? dupWallets / weightByVoter.size : 0;

    return {
      whaleShare: topShare(perVoter),
      top3Share: topKShare(perVoter, 3),
      gini: gini(perVoter),
      turnout:
        proposal.memberCount != null && proposal.memberCount > 0
          ? weightByVoter.size / proposal.memberCount
          : null,
      quorumProgress:
        quorumTarget != null && quorumTarget > 0
          ? totalWeight / quorumTarget
          : null,
      voterCount: weightByVoter.size,
      totalWeight,
      dupTimestampRatio,
      votingWindowSeconds,
      averageVotesPerDay:
        votingWindowSeconds != null
          ? (weightByVoter.size / votingWindowSeconds) * 86_400
          : null,
      averageVotesPerHour:
        votingWindowSeconds != null
          ? (weightByVoter.size / votingWindowSeconds) * 3_600
          : null,
      averageVotesPerMinute:
        votingWindowSeconds != null
          ? (weightByVoter.size / votingWindowSeconds) * 60
          : null,
      expectedDupTimestampRatio,
      dupTimestampExcess:
        expectedDupTimestampRatio != null
          ? dupTimestampRatio - expectedDupTimestampRatio
          : null,
      dupTimestampLift:
        expectedDupTimestampRatio != null && expectedDupTimestampRatio > 0
          ? dupTimestampRatio / expectedDupTimestampRatio
          : null,
      dupTimestampSensitivity:
        votingWindowSeconds != null
          ? duplicateTimestampSensitivity(
              weightByVoter.size,
              votingWindowSeconds,
            )
          : [],
      walletsFor50Pct,
      lateWeightShare,
    };
  }

  function ingest(event: VoteEvent): Snapshot {
    votes.push(event);
    weightByVoter.set(
      event.voter,
      (weightByVoter.get(event.voter) ?? 0) + event.weight,
    );
    let tsVoters = votersByTimestamp.get(event.timestamp);
    if (!tsVoters) {
      tsVoters = new Set();
      votersByTimestamp.set(event.timestamp, tsVoters);
    }
    tsVoters.add(event.voter);

    const voteIndex = votes.length;
    const at = event.timestamp;
    const signals = computeSignals();
    const newAlerts: Alert[] = [];

    // Lock in the voting type on the first ballot if it wasn't declared.
    if (resolvedVoteType === null) {
      resolvedVoteType = inferVoteType(event.choice);
    }
    const voteType = resolvedVoteType;

    // --- Whale dominance ---------------------------------------------------
    if (signals.whaleShare >= cfg.whaleExtremeThreshold) {
      fire(newAlerts, "whale:extreme", {
        signal: "whale",
        severity: "extreme",
        message: `Single wallet controls ${pct(signals.whaleShare)} of voting weight`,
        at,
        voteIndex,
      });
    } else if (
      signals.whaleShare >= cfg.whaleModerateThreshold ||
      signals.top3Share >= cfg.top3ModerateThreshold
    ) {
      fire(newAlerts, "whale:moderate", {
        signal: "whale",
        severity: "moderate",
        message: `Concentrated voting weight: top wallet ${pct(signals.whaleShare)}, top-3 ${pct(signals.top3Share)}`,
        at,
        voteIndex,
      });
    }

    // --- Quorum / turnout --------------------------------------------------
    const quorumMet =
      signals.quorumProgress != null && signals.quorumProgress >= 1;
    if (quorumMet) {
      fire(newAlerts, "quorum:met", {
        signal: "quorum",
        severity: "none",
        message: `Quorum reached with ${signals.voterCount} voter(s)`,
        at,
        voteIndex,
      });
      if (
        signals.turnout != null &&
        signals.turnout < cfg.criticalTurnout
      ) {
        fire(newAlerts, "turnout:critical", {
          signal: "turnout",
          severity: "strong",
          message: `Quorum satisfied by ${pct(signals.turnout)} of members (${signals.voterCount} of ${proposal.memberCount}) — participation failure`,
          at,
          voteIndex,
        });
      }
    }

    // --- Late influence -----------------------------------------------------
    // A large share of weight arriving in the final slice of the window is a
    // proxy for late influence (late voting, not late token acquisition —
    // see Signals.lateWeightShare). Stronger when that late weight is also
    // whale-concentrated.
    if (
      signals.lateWeightShare != null &&
      signals.lateWeightShare >= cfg.lateWeightShareThreshold
    ) {
      const whaleLate = signals.whaleShare >= cfg.whaleModerateThreshold;
      fire(newAlerts, "late:influence", {
        signal: "late",
        severity: whaleLate ? "strong" : "moderate",
        message: `${pct(signals.lateWeightShare)} of voting weight arrived in the final ${pct(cfg.lateWindowFraction)} of the window${whaleLate ? " and is whale-concentrated" : ""}`,
        at,
        voteIndex,
      });
    }

    // --- Cluster detectors (deduped by cluster key) -------------------------
    // Sybil always applies; collusion only for vote types where identical
    // ballots are meaningful (per the vulnerability matrix) — identical "For"
    // votes under single/basic are ordinary, not collusion.
    const clusterCandidates: Array<Cluster | null> = [detectSybilAt(votes, cfg)];
    if (detectorApplies(voteType, "collusion")) {
      clusterCandidates.push(detectCollusionAt(votes, cfg, voteType));
    }
    for (const cluster of clusterCandidates) {
      if (cluster && !seenClusterKeys.has(cluster.key)) {
        seenClusterKeys.add(cluster.key);
        fireCluster(newAlerts, cluster, at, voteIndex);
      }
    }

    // --- Counterfactuals + robustness ---------------------------------------
    const outcomes = computeOutcomes(votes);
    const robustness = classifyRobustness(outcomes);

    // --- Tiered rule selection -----------------------------------------------
    // Tier 1: outright whale dominance -> 1W1V.
    // Tier 2: corroborated sybil/collusion cluster evidence -> QV.
    // Exact-second collisions remain visible as a timing signal, but do not
    // select a rule by themselves: large elections and activity peaks create
    // natural collisions, and a single brittle threshold is easy to game.
    // Otherwise the token rule stands.
    const clusterEvidence = alerts.some(
      (a) => a.signal === "sybil" || a.signal === "collusion",
    );
    const recommendedRule: Snapshot["recommendedRule"] =
      signals.whaleShare >= cfg.whaleExtremeThreshold
        ? "1W1V"
        : clusterEvidence
          ? "QV"
          : "1T1V";

    // --- Pre-authorised escalation policy (advisory) -------------------------
    // Fires when the vote is decisive enough to matter (quorum met) AND the
    // detected conditions are severe AND the outcome is not rule-robust.
    if (
      !escalated &&
      quorumMet &&
      severity === "extreme" &&
      robustness !== "robust"
    ) {
      escalated = true;
      fire(newAlerts, "policy:escalation", {
        signal: "policy",
        severity: "extreme",
        message: `Pre-authorised policy would fire here: freeze execution, open review window, pivot recount to ${recommendedRule}`,
        at,
        voteIndex,
      });
    }

    last = {
      proposal,
      voteIndex,
      lastEvent: event,
      signals,
      newAlerts,
      alerts: [...alerts],
      severity,
      outcomes,
      robustness,
      recommendedRule,
      escalated,
    };
    return last;
  }

  function fireCluster(
    newAlerts: Alert[],
    cluster: Cluster,
    at: number,
    voteIndex: number,
  ): void {
    fire(newAlerts, `${cluster.kind}:${cluster.key}`, {
      signal: cluster.kind,
      severity: cluster.severity,
      message: `${cluster.kind === "sybil" ? "Sybil-shaped" : "Collusion-shaped"} cluster: ${cluster.size} ballots (${cluster.reasons.join("; ")})`,
      at,
      voteIndex,
    });
  }

  return {
    ingest,
    snapshot: () => last,
  };
}

/**
 * Replay a full event stream, returning every intermediate snapshot.
 * This is the Replay Player's data: frame i = snapshots[i].
 */
export function replay(
  proposal: ProposalContext,
  events: readonly VoteEvent[],
  config: Partial<EngineConfig> = {},
): Snapshot[] {
  const engine = createEngine(proposal, config);
  const sorted = [...events].sort((a, b) => a.timestamp - b.timestamp);
  return sorted.map((e) => engine.ingest(e));
}

function emptySnapshot(proposal: ProposalContext): Snapshot {
  return {
    proposal,
    voteIndex: 0,
    lastEvent: null,
    signals: {
      whaleShare: 0,
      top3Share: 0,
      gini: 0,
      turnout: proposal.memberCount != null ? 0 : null,
      quorumProgress:
        proposal.totalSupply != null && proposal.quorumFraction != null
          ? 0
          : null,
      voterCount: 0,
      totalWeight: 0,
      dupTimestampRatio: 0,
      votingWindowSeconds:
        proposal.end > proposal.start ? proposal.end - proposal.start : null,
      averageVotesPerDay: 0,
      averageVotesPerHour: 0,
      averageVotesPerMinute: 0,
      expectedDupTimestampRatio: null,
      dupTimestampExcess: null,
      dupTimestampLift: null,
      dupTimestampSensitivity: [],
      walletsFor50Pct: 0,
      lateWeightShare: null,
    },
    newAlerts: [],
    alerts: [],
    severity: "none",
    outcomes: [],
    robustness: "n/a",
    recommendedRule: "1T1V",
    escalated: false,
  };
}

function pct(x: number): string {
  return `${(x * 100).toFixed(x >= 0.1 ? 1 : 3)}%`;
}
