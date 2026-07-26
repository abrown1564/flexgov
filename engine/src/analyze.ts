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
import {
  duplicateTimestampSensitivity,
  expectedDuplicateTimestampRatio,
  gini,
  topKShare,
  topShare,
} from "./signals.js";
import { computeOutcomes, classifyRobustness } from "./counterfactuals.js";

/**
 * Batch analysis — the one-shot counterpart to replay().
 *
 * replay() is for the animated Replay Player: it retains a Snapshot per vote so
 * the UI can scrub the timeline. That is the WRONG tool for bulk analysis of a
 * large proposal (e.g. 62k votes), where it recomputes everything per vote and
 * keeps 62k snapshots. This function computes the final signals, counterfactuals
 * and threshold alerts ONCE, in ~O(n log n), and returns a single Snapshot with
 * the same shape the UI already renders.
 *
 * Scope note: the windowed cluster detectors (sybil/collusion) are NOT run here
 * yet — they need an efficient single-sweep rewrite to be fast at scale. Batch
 * therefore reports concentration, turnout/quorum, late-influence, counterfactuals
 * and robustness, but not cluster alerts. Use replay() for small proposals when
 * cluster detection is required. (Tracked as follow-up work.)
 */
export function analyze(
  proposal: ProposalContext,
  events: readonly VoteEvent[],
  config: Partial<EngineConfig> = {},
): Snapshot {
  const cfg: EngineConfig = { ...DEFAULT_CONFIG, ...config };

  // --- one pass to aggregate per-voter weight + timestamp helpers -----------
  const weightByVoter = new Map<string, number>();
  const votersByTimestamp = new Map<number, Set<string>>();
  let totalWeight = 0;
  for (const e of events) {
    weightByVoter.set(e.voter, (weightByVoter.get(e.voter) ?? 0) + e.weight);
    totalWeight += e.weight;
    let set = votersByTimestamp.get(e.timestamp);
    if (!set) {
      set = new Set();
      votersByTimestamp.set(e.timestamp, set);
    }
    set.add(e.voter);
  }
  const perVoter = [...weightByVoter.values()];

  // duplicate-timestamp Sybil proxy
  let dupWallets = 0;
  for (const set of votersByTimestamp.values()) {
    if (set.size > 1) dupWallets += set.size;
  }

  // smallest wallet set controlling >=50% of cast weight
  let walletsFor50Pct = 0;
  if (totalWeight > 0) {
    let acc = 0;
    for (const w of [...perVoter].sort((a, b) => b - a)) {
      acc += w;
      walletsFor50Pct += 1;
      if (acc >= totalWeight / 2) break;
    }
  }

  // late-influence: share of weight arriving in the final window slice
  let lateWeightShare: number | null = null;
  const windowLength = proposal.end - proposal.start;
  if (windowLength > 0 && totalWeight > 0) {
    const lateCutoff = proposal.end - windowLength * cfg.lateWindowFraction;
    let lateWeight = 0;
    for (const e of events) if (e.timestamp >= lateCutoff) lateWeight += e.weight;
    lateWeightShare = lateWeight / totalWeight;
  }

  const quorumTarget =
    proposal.totalSupply != null && proposal.quorumFraction != null
      ? proposal.totalSupply * proposal.quorumFraction
      : null;

  // Put the observed collision rate beside explicit comparison assumptions.
  // The flat and compressed-window baselines are sensitivity checks—not an
  // attempt to infer voter geography from public wallet activity.
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

  const signals: Signals = {
    whaleShare: topShare(perVoter),
    top3Share: topKShare(perVoter, 3),
    gini: gini(perVoter),
    turnout:
      proposal.memberCount != null && proposal.memberCount > 0
        ? weightByVoter.size / proposal.memberCount
        : null,
    quorumProgress:
      quorumTarget != null && quorumTarget > 0 ? totalWeight / quorumTarget : null,
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

  // --- counterfactuals (one pass each) --------------------------------------
  const outcomes = computeOutcomes(events);
  const robustness = classifyRobustness(outcomes);

  // --- threshold alerts (mirrors the engine's per-vote logic, fired once) ---
  const at = events.length > 0 ? events[events.length - 1]!.timestamp : proposal.end;
  const voteIndex = events.length;
  const alerts: Alert[] = [];
  let severity = "none" as Severity;
  const fire = (a: Alert) => {
    alerts.push(a);
    severity = maxSeverity(severity, a.severity);
  };

  if (signals.whaleShare >= cfg.whaleExtremeThreshold) {
    fire({
      id: "whale:extreme",
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
    fire({
      id: "whale:moderate",
      signal: "whale",
      severity: "moderate",
      message: `Concentrated voting weight: top wallet ${pct(signals.whaleShare)}, top-3 ${pct(signals.top3Share)}`,
      at,
      voteIndex,
    });
  }

  const quorumMet =
    signals.quorumProgress != null && signals.quorumProgress >= 1;
  if (quorumMet) {
    fire({
      id: "quorum:met",
      signal: "quorum",
      severity: "none",
      message: `Quorum reached with ${signals.voterCount} voter(s)`,
      at,
      voteIndex,
    });
    if (signals.turnout != null && signals.turnout < cfg.criticalTurnout) {
      fire({
        id: "turnout:critical",
        signal: "turnout",
        severity: "strong",
        message: `Quorum satisfied by ${pct(signals.turnout)} of members (${signals.voterCount} of ${proposal.memberCount}) — participation failure`,
        at,
        voteIndex,
      });
    }
  }

  if (
    signals.lateWeightShare != null &&
    signals.lateWeightShare >= cfg.lateWeightShareThreshold
  ) {
    const whaleLate = signals.whaleShare >= cfg.whaleModerateThreshold;
    fire({
      id: "late:influence",
      signal: "late",
      severity: whaleLate ? "strong" : "moderate",
      message: `${pct(signals.lateWeightShare)} of voting weight arrived in the final ${pct(cfg.lateWindowFraction)} of the window${whaleLate ? " and is whale-concentrated" : ""}`,
      at,
      voteIndex,
    });
  }

  // Batch mode has no corroborated cluster evidence yet. Exact-second
  // collisions remain visible but do not select QV by themselves.
  const recommendedRule: Snapshot["recommendedRule"] =
    signals.whaleShare >= cfg.whaleExtremeThreshold
      ? "1W1V"
      : "1T1V";

  // Derive severity from the fired alerts (avoids TS narrowing on the mutated
  // `severity` variable, and is a single source of truth).
  const isExtreme = alerts.some((a) => a.severity === "extreme");
  const escalated = quorumMet && isExtreme && robustness !== "robust";
  if (escalated) {
    fire({
      id: "policy:escalation",
      signal: "policy",
      severity: "extreme",
      message: `Pre-authorised policy would fire here: freeze execution, open review window, pivot recount to ${recommendedRule}`,
      at,
      voteIndex,
    });
  }

  return {
    proposal,
    voteIndex,
    lastEvent: events.length > 0 ? events[events.length - 1]! : null,
    signals,
    newAlerts: alerts,
    alerts,
    severity,
    outcomes,
    robustness,
    recommendedRule,
    escalated,
  };
}

function pct(x: number): string {
  return `${(x * 100).toFixed(x >= 0.1 ? 1 : 3)}%`;
}
