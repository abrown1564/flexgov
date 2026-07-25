import type {
  Alert,
  EngineConfig,
  ProposalContext,
  Severity,
  Signals,
  Snapshot,
  VoteEvent,
} from "./types.js";
import { DEFAULT_CONFIG, maxSeverity } from "./types.js";
import { gini, topKShare, topShare } from "./signals.js";
import { computeOutcomes, classifyRobustness } from "./counterfactuals.js";
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
      dupTimestampRatio:
        weightByVoter.size > 0 ? dupWallets / weightByVoter.size : 0,
      walletsFor50Pct,
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

    // --- Cluster detectors (deduped by cluster key) -------------------------
    for (const cluster of [
      detectSybilAt(votes, cfg),
      detectCollusionAt(votes, cfg),
    ]) {
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
    // Tier 2: sybil/collusion evidence or dup-timestamp burst -> QV.
    // Otherwise the token rule stands.
    const clusterEvidence = alerts.some(
      (a) => a.signal === "sybil" || a.signal === "collusion",
    );
    const recommendedRule: Snapshot["recommendedRule"] =
      signals.whaleShare >= cfg.whaleExtremeThreshold
        ? "1W1V"
        : clusterEvidence ||
            signals.dupTimestampRatio >= cfg.dupTsRatioThreshold
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
      walletsFor50Pct: 0,
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
