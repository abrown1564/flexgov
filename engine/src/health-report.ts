import type {
  Alert,
  CounterfactualRule,
  Robustness,
  RuleOutcome,
  Severity,
  Signals,
  Snapshot,
  VoteEvent,
  VoteType,
} from "./types.js";
import {
  classifyRobustness,
  computeApprovalOutcomes,
} from "./counterfactuals.js";

/**
 * Versioned machine-readable output of FlexGov analysis.
 *
 * The report keeps measurements, interpretations, suggested responses and
 * provenance separate. That boundary prevents an optional narrative or policy
 * recommendation from being mistaken for a deterministic engine finding.
 */
export interface GovernanceHealthReport {
  schema: "https://flexgov.org/schemas/governance-health-report/0.1.0";
  schemaVersion: "0.1.0";
  reportId: string;
  generatedAt: string;
  subject: {
    governanceSystem: "snapshot" | "evm-governor" | "realms" | "other";
    daoName: string;
    spaceOrDaoId: string;
    proposalId: string;
    title: string;
    state: string;
    voteType: VoteType | null;
    choices: string[];
    votingWindow: { start: number; end: number };
  };
  source: {
    provider: string;
    endpoint: string | null;
    retrievalMode: "live" | "precomputed";
    retrievedAt: string | null;
    voteCount: number;
    sourceDataHash: string | null;
    /** Provider-specific provenance sufficient to reproduce an indexed query. */
    graphProvenance?: {
      subgraphId: string;
      network: string;
      governorAddress: string;
      deploymentId: string | null;
      indexedBlockNumber: number | null;
      indexedBlockHash: string | null;
      hasIndexingErrors: boolean | null;
    };
  };
  /** On-chain Governor facts remain separate from inferred engine findings. */
  governanceContext?: {
    network: string;
    governorType: string;
    governorAddress: string;
    tokenAddress: string;
    timelockAddress: string;
    proposerAddress: string;
    quorumVotes: number;
    lifecycle: {
      creationTransaction: string;
      creationBlock: number;
      votingStartBlock: number;
      votingEndBlock: number;
      queuedTransaction: string | null;
      queuedBlock: number | null;
      queuedAt: number | null;
      executionEta: number | null;
      executionTransaction: string | null;
      executionBlock: number | null;
      executedAt: number | null;
    };
    actions: Array<{
      target: string;
      valueWei: string;
      signature: string;
    }>;
  };
  methodology: {
    engineName: "@flexgov/engine";
    engineVersion: string;
    engineCommit: string | null;
    analysisMode: "batch-final-state" | "stream-replay" | "live-stream";
    ballotInterpretation:
      | "first-selection"
      | "first-selection-and-full-approval";
    configurationHash: string | null;
  };
  deterministicFindings: {
    signals: Signals;
    ballotInterpretations: {
      firstSelection: {
        status: "computed";
        outcomes: RuleOutcome[];
        robustness: Robustness;
      };
      fullApproval: {
        status: "planned" | "computed" | "not-applicable";
        outcomes: RuleOutcome[] | null;
        robustness: Robustness | null;
      };
    };
    alerts: Alert[];
    severity: Severity;
    recommendedRule: CounterfactualRule;
    escalated: boolean;
  };
  dataAvailability: Array<{
    id: string;
    label: string;
    status: "available" | "unavailable" | "not-connected" | "experimental";
    reason: string | null;
  }>;
  suggestedActions: Array<{
    action: string;
    basis: string[];
    authority: "advisory" | "pre-authorised-policy";
  }>;
  limitations: string[];
  verification: {
    reportHash: string | null;
    storageUri: string | null;
    computeAttestation: string | null;
    chainAttestation: string | null;
  };
  /** Optional ballot samples support inspection without embedding all votes. */
  evidencePreview?: {
    ballots: Array<{
      id: string;
      voter: string;
      votingPower: number;
      choice: number | number[] | Record<string, number>;
      created: number;
    }>;
  };
}

export interface HealthReportInput {
  reportId: string;
  generatedAt: string;
  subject: GovernanceHealthReport["subject"];
  source: GovernanceHealthReport["source"];
  governanceContext?: GovernanceHealthReport["governanceContext"];
  methodology?: Partial<GovernanceHealthReport["methodology"]>;
  snapshot: Snapshot;
  dataAvailability: GovernanceHealthReport["dataAvailability"];
  suggestedActions?: GovernanceHealthReport["suggestedActions"];
  limitations?: string[];
  evidencePreview?: GovernanceHealthReport["evidencePreview"];
  /**
   * Complete ballots are optional because a canonical report may be assembled
   * from saved aggregates. Approval outcomes are computed only when the full
   * ballot set is supplied; a preview must never masquerade as the electorate.
   */
  ballotEvents?: readonly VoteEvent[];
}

/**
 * Construct a canonical report without fabricating provenance.
 *
 * Hashes, storage URIs and attestations remain null until the corresponding
 * calculation or external write succeeds. Callers may then create a new report
 * value containing the verified references.
 */
export function buildGovernanceHealthReport(
  input: HealthReportInput,
): GovernanceHealthReport {
  const isApproval = input.subject.voteType === "approval";
  const fullApprovalOutcomes =
    isApproval && input.ballotEvents
      ? computeApprovalOutcomes(input.ballotEvents)
      : null;
  const fullApprovalStatus = !isApproval
    ? "not-applicable"
    : fullApprovalOutcomes
      ? "computed"
      : "planned";

  return {
    schema: "https://flexgov.org/schemas/governance-health-report/0.1.0",
    schemaVersion: "0.1.0",
    reportId: input.reportId,
    generatedAt: input.generatedAt,
    subject: input.subject,
    source: input.source,
    ...(input.governanceContext
      ? { governanceContext: input.governanceContext }
      : {}),
    methodology: {
      engineName: "@flexgov/engine",
      engineVersion: "0.0.1",
      engineCommit: null,
      analysisMode: "batch-final-state",
      // Methodology must name both views when the report actually contains
      // both; otherwise verification metadata would under-describe the result.
      ballotInterpretation: fullApprovalOutcomes
        ? "first-selection-and-full-approval"
        : "first-selection",
      configurationHash: null,
      ...input.methodology,
    },
    deterministicFindings: {
      signals: input.snapshot.signals,
      ballotInterpretations: {
        firstSelection: {
          status: "computed",
          outcomes: input.snapshot.outcomes,
          robustness: input.snapshot.robustness,
        },
        fullApproval: {
          status: fullApprovalStatus,
          outcomes: fullApprovalOutcomes,
          robustness: fullApprovalOutcomes
            ? classifyRobustness(fullApprovalOutcomes)
            : null,
        },
      },
      alerts: input.snapshot.alerts,
      severity: input.snapshot.severity,
      recommendedRule: input.snapshot.recommendedRule,
      escalated: input.snapshot.escalated,
    },
    dataAvailability: input.dataAvailability,
    suggestedActions: input.suggestedActions ?? [],
    limitations: input.limitations ?? [],
    verification: {
      reportHash: null,
      storageUri: null,
      computeAttestation: null,
      chainAttestation: null,
    },
    ...(input.evidencePreview
      ? { evidencePreview: input.evidencePreview }
      : {}),
  };
}
