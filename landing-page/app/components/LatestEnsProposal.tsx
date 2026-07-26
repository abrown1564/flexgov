"use client";

import { useRef, useState } from "react";
import {
  analyseSnapshotProposal,
  mapSnapshotVoteType,
  toVoteEvents,
} from "./engineAdapter";
import {
  DEFAULT_CONFIG,
  buildGovernanceHealthReport,
  canonicalJson,
  classifyRobustness,
  computeApprovalOutcomes,
  hashGovernanceHealthReport,
  sha256Hex,
} from "../../../engine/src/index.js";
import type {
  GovernanceHealthReport,
  Snapshot as EngineSnapshot,
} from "../../../engine/src/index.js";
import arbitrumReportJson from "../data/arbitrum-health-report.json";
import ensReportJson from "../data/ens-health-report.json";
import gitcoinReportJson from "../data/gitcoin-health-report.json";
import optimismReportJson from "../data/optimism-health-report.json";
import sushiReportJson from "../data/sushi-health-report.json";
import uniswapReportJson from "../data/uniswap-health-report.json";

/**
 * This is the smallest useful shape returned by Snapshot Hub for this panel.
 * Keeping it narrow makes it clear which external fields the frontend uses.
 */
type SnapshotProposal = {
  id: string;
  title: string;
  state: string;
  choices: string[];
  votes: number;
  start: number;
  end: number;
  // Snapshot's voting type (e.g. "single-choice", "ranked-choice"); drives the
  // engine's vote-type-aware detectors.
  type: string;
};

type ProposalQueryResponse = {
  data?: {
    proposals: SnapshotProposal[];
  };
  errors?: Array<{ message: string }>;
};

/**
 * Snapshot supports several ballot formats. A basic vote is a number, while
 * approval, ranked, and weighted ballots can arrive as arrays or objects.
 */
type SnapshotChoice = number | number[] | Record<string, number>;

type SnapshotVote = {
  id: string;
  voter: string;
  vp: number;
  choice: SnapshotChoice;
  created: number;
};

type VoteQueryResponse = {
  data?: {
    votes: SnapshotVote[];
  };
  errors?: Array<{ message: string }>;
};

// The JSON Schema is the portable artifact; this cast connects the checked-in
// fixture to its matching TypeScript contract without changing runtime data.
const optimismReport =
  optimismReportJson as unknown as GovernanceHealthReport;
const ensReport = ensReportJson as unknown as GovernanceHealthReport;
const arbitrumReport =
  arbitrumReportJson as unknown as GovernanceHealthReport;
const uniswapReport =
  uniswapReportJson as unknown as GovernanceHealthReport;
const gitcoinReport =
  gitcoinReportJson as unknown as GovernanceHealthReport;
const sushiReport = sushiReportJson as unknown as GovernanceHealthReport;

// Reports are keyed by immutable proposal ID. The DAO's moving "latest"
// pointer can therefore use a saved analysis only when it is an exact match.
const savedReports = [
  ensReport,
  arbitrumReport,
  uniswapReport,
  gitcoinReport,
  sushiReport,
  optimismReport,
];
const precomputedReports = new Map<string, GovernanceHealthReport>([
  ...savedReports.map(
    (report) => [report.subject.proposalId, report] as const,
  ),
]);
const precomputedReportsBySpace = new Map<string, GovernanceHealthReport>(
  savedReports.map((report) => [report.subject.spaceOrDaoId, report]),
);

type ApprovalInterpretation =
  GovernanceHealthReport["deterministicFindings"]["ballotInterpretations"]["fullApproval"];

/** Present canonical report identity through the existing proposal component. */
function proposalFromReport(
  report: GovernanceHealthReport,
): SnapshotProposal {
  return {
    id: report.subject.proposalId,
    title: report.subject.title,
    state: report.subject.state,
    choices: report.subject.choices,
    votes: report.source.voteCount,
    start: report.subject.votingWindow.start,
    end: report.subject.votingWindow.end,
    type: report.subject.voteType ?? "single-choice",
  };
}

/**
 * Rehydrate the engine-shaped view expected by the current report renderer.
 * Suggested actions and verification metadata deliberately remain outside this
 * object so the UI cannot mistake them for deterministic engine findings.
 */
function analysisFromReport(
  report: GovernanceHealthReport,
): EngineSnapshot {
  const findings = report.deterministicFindings;
  return {
    proposal: {
      id: report.subject.proposalId,
      title: report.subject.title,
      start: report.subject.votingWindow.start,
      end: report.subject.votingWindow.end,
      choices: report.subject.choices,
      voteType: report.subject.voteType ?? undefined,
    },
    voteIndex: report.source.voteCount,
    lastEvent: null,
    signals: findings.signals,
    newAlerts: [],
    alerts: findings.alerts,
    severity: findings.severity,
    outcomes: findings.ballotInterpretations.firstSelection.outcomes ?? [],
    robustness: findings.ballotInterpretations.firstSelection.robustness ?? "n/a",
    recommendedRule: findings.recommendedRule,
    escalated: findings.escalated,
  };
}

/** Convert the report's small evidence sample back to Snapshot table rows. */
function previewVotesFromReport(
  report: GovernanceHealthReport,
): SnapshotVote[] {
  return (report.evidencePreview?.ballots ?? []).map((ballot) => ({
    id: ballot.id,
    voter: ballot.voter,
    vp: ballot.votingPower,
    choice: ballot.choice,
    created: ballot.created,
  }));
}

// Snapshot Hub contains off-chain Snapshot proposals and ballots.
const SNAPSHOT_HUB_ENDPOINT = "https://hub.snapshot.org/graphql";

/**
 * Labels are kept separate from Snapshot IDs because the API requires the
 * exact space identifier rather than the DAO's display name.
 */
const DAO_OPTIONS = [
  { name: "ENS", space: "ens.eth" },
  { name: "Arbitrum", space: "arbitrumfoundation.eth" },
  { name: "Uniswap", space: "uniswapgovernance.eth" },
  { name: "Gitcoin", space: "gitcoindao.eth" },
  { name: "Sushi", space: "sushigov.eth" },
  { name: "Optimism", space: "opcollective.eth" },
] as const;

type DaoOption = (typeof DAO_OPTIONS)[number];

// The selected space is a variable, while the result stays limited to one.
const LATEST_PROPOSAL_QUERY = `
  query LatestProposal($space: String!) {
    proposals(
      first: 1
      where: { space_in: [$space] }
      orderBy: "created"
      orderDirection: desc
    ) {
      id
      title
      state
      choices
      votes
      start
      end
      type
    }
  }
`;

// Votes are requested oldest-first so the table reflects proposal chronology.
// Paginated with a `created` cursor (not `skip`) so we can fetch every vote in
// a proposal without hitting Snapshot's skip cap. 1000 is the per-query max.
const PROPOSAL_VOTES_QUERY = `
  query ProposalVotes($proposalId: String!, $createdGte: Int!) {
    votes(
      first: 1000
      where: { proposal: $proposalId, created_gte: $createdGte }
      orderBy: "created"
      orderDirection: asc
    ) {
      id
      voter
      vp
      choice
      created
    }
  }
`;

// How many votes to show in the table. The engine analyses ALL of them; the
// table is just a preview of the first few.
const VOTE_TABLE_PREVIEW = 10;

export function LatestEnsProposal() {
  // Nothing is fetched automatically: the user initiates the live request.
  const [selectedDao, setSelectedDao] = useState<DaoOption>(DAO_OPTIONS[0]);
  const [proposal, setProposal] = useState<SnapshotProposal | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState("");
  const [votes, setVotes] = useState<SnapshotVote[]>([]);
  const [votesStatus, setVotesStatus] = useState<
    "idle" | "loading" | "error"
  >("idle");
  const [votesError, setVotesError] = useState("");
  // The engine's analysis of the currently loaded proposal + votes, if any.
  const [analysis, setAnalysis] = useState<EngineSnapshot | null>(null);
  // Approval is a second interpretation of the same ballots, not a replacement
  // for the first-selection plurality view stored in EngineSnapshot.
  const [fullApproval, setFullApproval] =
    useState<ApprovalInterpretation | null>(null);
  // The canonical report is kept separately from the renderer's EngineSnapshot
  // so verification metadata cannot be confused with deterministic findings.
  const [canonicalReport, setCanonicalReport] =
    useState<GovernanceHealthReport | null>(null);
  // Tracks whether the shown result came from a live fetch or the precomputed
  // showcase fixture, so the UI can label it honestly.
  const [dataSource, setDataSource] = useState<"live" | "precomputed">("live");
  // For a precomputed proposal the true total differs from the preview count.
  const [totalVotes, setTotalVotes] = useState<number | null>(null);
  const proposalRequestId = useRef(0);

  async function fetchLatestProposal(dao: DaoOption = selectedDao) {
    // Only the newest DAO request may update the panel if buttons are clicked quickly.
    const requestId = ++proposalRequestId.current;
    setStatus("loading");
    setError("");
    // A newly loaded proposal invalidates any votes shown for the previous one.
    setVotes([]);
    setVotesStatus("idle");
    setVotesError("");
    setAnalysis(null);
    setFullApproval(null);
    setCanonicalReport(null);
    setDataSource("live");
    setTotalVotes(null);

    // Optimism uses the saved #9b case study rather than pretending its cached
    // 62,245-vote analysis belongs to whichever proposal happens to be latest.
    if (dao.space === "opcollective.eth") {
      setProposal(proposalFromReport(optimismReport));
      setDataSource("precomputed");
      setStatus("idle");
      return;
    }

    try {
      const response = await fetch(SNAPSHOT_HUB_ENDPOINT, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          query: LATEST_PROPOSAL_QUERY,
          variables: { space: dao.space },
        }),
      });

      if (!response.ok) {
        throw new Error(`Snapshot returned HTTP ${response.status}`);
      }

      const result = (await response.json()) as ProposalQueryResponse;
      if (result.errors?.length) {
        throw new Error(result.errors.map(({ message }) => message).join("; "));
      }

      const latest = result.data?.proposals[0];
      if (!latest) {
        throw new Error(`Snapshot returned no ${dao.name} proposals.`);
      }

      if (requestId !== proposalRequestId.current) return;
      setProposal(latest);
      setStatus("idle");
    } catch (caught) {
      if (requestId !== proposalRequestId.current) return;
      setProposal(null);
      setStatus("error");
      setError(
        caught instanceof Error ? caught.message : "The request did not complete.",
      );
    }
  }

  function selectDao(dao: DaoOption) {
    // Pass the clicked DAO directly because React state updates asynchronously.
    setSelectedDao(dao);
    setProposal(null);
    void fetchLatestProposal(dao);
  }

  /** Load the DAO's immutable closed-proposal report without hiding live data. */
  function loadSavedReport() {
    const report = precomputedReportsBySpace.get(selectedDao.space);
    if (!report) return;

    setProposal(proposalFromReport(report));
    setStatus("idle");
    setError("");
    setVotes([]);
    setVotesStatus("idle");
    setVotesError("");
    setAnalysis(null);
    setFullApproval(null);
    setCanonicalReport(null);
    setDataSource("precomputed");
    setTotalVotes(null);
  }

  async function fetchProposalVotes() {
    if (!proposal) return;

    // A pinned report is reused only for the exact proposal ID. If a DAO
    // publishes a newer proposal, the UI falls through to a fresh live fetch.
    const savedReport = precomputedReports.get(proposal.id);
    if (savedReport) {
      setVotesStatus("idle");
      setVotesError("");
      setDataSource("precomputed");
      setVotes(previewVotesFromReport(savedReport));
      setTotalVotes(savedReport.source.voteCount);
      setAnalysis(analysisFromReport(savedReport));
      setFullApproval(
        savedReport.deterministicFindings.ballotInterpretations.fullApproval,
      );
      setCanonicalReport(savedReport);
      return;
    }

    setVotesStatus("loading");
    setVotesError("");

    try {
      // Page through EVERY vote in the proposal so the engine analyses the
      // whole electorate, not a sample. Cursor on `created` (>=) with id-dedup
      // avoids Snapshot's skip cap and handles same-timestamp ties.
      const pageSize = 1000;
      const all: SnapshotVote[] = [];
      const seen = new Set<string>();
      let createdGte = 0;

      while (true) {
        const response = await fetch(SNAPSHOT_HUB_ENDPOINT, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            query: PROPOSAL_VOTES_QUERY,
            variables: { proposalId: proposal.id, createdGte },
          }),
        });

        if (!response.ok) {
          throw new Error(`Snapshot returned HTTP ${response.status}`);
        }

        const result = (await response.json()) as VoteQueryResponse;
        if (result.errors?.length) {
          throw new Error(
            result.errors.map(({ message }) => message).join("; "),
          );
        }

        const page = result.data?.votes ?? [];
        if (page.length === 0) break;

        let added = 0;
        for (const vote of page) {
          if (!seen.has(vote.id)) {
            seen.add(vote.id);
            all.push(vote);
            added += 1;
          }
        }

        // Last page reached.
        if (page.length < pageSize) break;
        // Safety: if a single timestamp holds >pageSize votes we can't advance;
        // stop rather than loop forever (rare, and acceptable for the preview).
        if (added === 0) break;
        // Advance the cursor to the newest timestamp seen; dedup covers ties.
        createdGte = page[page.length - 1]!.created;
      }

      // Table shows a preview; the engine analyses the full set.
      setVotes(all);
      setTotalVotes(all.length);
      setVotesStatus("idle");
      const liveAnalysis = analyseSnapshotProposal(proposal, all);
      setAnalysis(liveAnalysis);
      if (proposal.type === "approval") {
        // Full approval gives every selected option the ballot's transformed
        // weight. It is computed from the complete fetched electorate, never
        // from the small ballot table preview.
        const approvalOutcomes = computeApprovalOutcomes(toVoteEvents(all));
        setFullApproval({
          status: "computed",
          outcomes: approvalOutcomes,
          robustness: classifyRobustness(approvalOutcomes),
        });
      } else {
        setFullApproval({
          status: "not-applicable",
          outcomes: null,
          robustness: null,
        });
      }

      if (liveAnalysis) {
        // Sort by immutable vote ID before hashing so pagination order cannot
        // change the source digest for an otherwise identical ballot set.
        const sourceDataHash = await sha256Hex(
          canonicalJson([...all].sort((a, b) => a.id.localeCompare(b.id))),
        );
        const configurationHash = await sha256Hex(
          canonicalJson(DEFAULT_CONFIG),
        );
        const generatedAt = new Date().toISOString();
        const report = buildGovernanceHealthReport({
          reportId: `snapshot:${selectedDao.space}:${proposal.id}`,
          generatedAt,
          subject: {
            governanceSystem: "snapshot",
            daoName: selectedDao.name,
            spaceOrDaoId: selectedDao.space,
            proposalId: proposal.id,
            title: proposal.title,
            state: proposal.state,
            voteType: mapSnapshotVoteType(proposal.type) ?? null,
            choices: proposal.choices,
            votingWindow: { start: proposal.start, end: proposal.end },
          },
          source: {
            provider: "Snapshot Hub API",
            endpoint: SNAPSHOT_HUB_ENDPOINT,
            retrievalMode: "live",
            retrievedAt: generatedAt,
            voteCount: all.length,
            sourceDataHash,
          },
          methodology: {
            analysisMode: "batch-final-state",
            configurationHash,
          },
          snapshot: liveAnalysis,
          ballotEvents: toVoteEvents(all),
          dataAvailability: [
            {
              id: "ballots",
              label: "Voting power and ballots",
              status: "available",
              reason: null,
            },
            {
              id: "timing",
              label: "Voting window and timing",
              status: "available",
              reason: null,
            },
            {
              id: "turnout",
              label: "Eligible-member turnout",
              status: "unavailable",
              reason:
                "Snapshot Hub does not provide an eligible-member denominator.",
            },
            {
              id: "quorum",
              label: "On-chain quorum progress",
              status: "unavailable",
              reason:
                "This Snapshot report has no authoritative total-supply quorum input.",
            },
          ],
          // Ten ballots make the report inspectable without embedding the full
          // source archive; sourceDataHash commits to the complete fetched set.
          evidencePreview: {
            ballots: all.slice(0, VOTE_TABLE_PREVIEW).map((vote) => ({
              id: vote.id,
              voter: vote.voter,
              votingPower: vote.vp,
              choice: vote.choice,
              created: vote.created,
            })),
          },
        });
        const reportHash = await hashGovernanceHealthReport(report);
        setCanonicalReport({
          ...report,
          verification: { ...report.verification, reportHash },
        });
      }
    } catch (caught) {
      setVotes([]);
      setVotesStatus("error");
      setAnalysis(null);
      setFullApproval(null);
      setCanonicalReport(null);
      setVotesError(
        caught instanceof Error ? caught.message : "The request did not complete.",
      );
    }
  }

  return (
    <section className="live-data-section" id="live-data">
      <div className="dao-selector" aria-label="Choose a DAO">
        {DAO_OPTIONS.map((dao) => (
          <button
            className={dao.space === selectedDao.space ? "active" : undefined}
            type="button"
            key={dao.space}
            aria-pressed={dao.space === selectedDao.space}
            onClick={() => selectDao(dao)}
            disabled={status === "loading" && dao.space === selectedDao.space}
          >
            {dao.name}
          </button>
        ))}
      </div>

      <div className="live-data-intro">
        <div className="section-index">
          Live data / {selectedDao.name} governance
        </div>
        <h2>
          Explore the {selectedDao.name === "Optimism" ? "" : "latest"}
          <br />
          <em>
            {selectedDao.name}
            {selectedDao.name === "Optimism" ? " case study." : " proposal."}
          </em>
        </h2>
        <p>
          {selectedDao.name === "Optimism"
            ? "Inspect Special Voting Cycle #9b and its saved 62,245-vote analysis."
            : "Inspect its choices, participation, status, and voting window using current governance data."}
        </p>
        <div className="live-data-actions">
          <button
            className="live-data-button"
            type="button"
            // Wrap the call so React's click event is not mistaken for a DAO.
            onClick={() => void fetchLatestProposal()}
            disabled={status === "loading"}
          >
            {status === "loading"
              ? "Fetching…"
              : selectedDao.name === "Optimism"
                ? "Load Optimism case study"
                : `Fetch latest ${selectedDao.name} proposal`}
            <span aria-hidden="true">→</span>
          </button>
          {selectedDao.name !== "Optimism" &&
            precomputedReportsBySpace.has(selectedDao.space) && (
              <button
                className="saved-report-button"
                type="button"
                onClick={loadSavedReport}
              >
                Load verified closed report
              </button>
            )}
        </div>
      </div>

      <div className="proposal-panel" aria-live="polite">
        <div className="proposal-panel-bar">
          <span>Source</span>
          <strong>
            {dataSource === "precomputed"
              ? "Snapshot Hub · precomputed"
              : "Snapshot Hub · live"}
          </strong>
        </div>

        {!proposal && status !== "error" && (
          <div className="proposal-empty">
            <span>{selectedDao.space}</span>
            <p>
              Load the most recently published proposal from the{" "}
              {selectedDao.name} governance space.
            </p>
          </div>
        )}

        {status === "error" && (
          <div className="proposal-error" role="alert">
            <strong>Request unsuccessful</strong>
            <p>{error}</p>
          </div>
        )}

        {proposal && (
          <article className="proposal-result">
            <div className="proposal-result-heading">
              <span className="proposal-space">{selectedDao.space}</span>
              <span className={`proposal-state state-${proposal.state}`}>
                {proposal.state}
              </span>
            </div>
            <h3>{proposal.title}</h3>
            <dl>
              <div>
                <dt>Votes</dt>
                <dd>{proposal.votes.toLocaleString()}</dd>
              </div>
              <div>
                <dt>Starts</dt>
                <dd>{formatUnixDate(proposal.start)}</dd>
              </div>
              <div>
                <dt>Ends</dt>
                <dd>{formatUnixDate(proposal.end)}</dd>
              </div>
            </dl>
            <details className="support-disclosure proposal-choices">
              <summary>
                <span>Available choices</span>
                <strong>{proposal.choices.length}</strong>
              </summary>
              <ul>
                {proposal.choices.map((choice) => (
                  <li key={choice}>{choice}</li>
                ))}
              </ul>
            </details>

            <div className="proposal-votes-action">
              <button
                type="button"
                onClick={fetchProposalVotes}
                disabled={
                  votesStatus === "loading" ||
                  (dataSource === "precomputed" && analysis !== null)
                }
              >
                {votesStatus === "loading"
                  ? "Loading all votes…"
                  : dataSource === "precomputed" && analysis
                    ? "Votes loaded"
                    : analysis
                      ? "Reload votes"
                      : "Load votes"}
                <span aria-hidden="true">↓</span>
              </button>
              <small>
                {(() => {
                  const total = totalVotes ?? votes.length;
                  if (total === 0) {
                    return "Loads every vote; analysis runs on the full proposal";
                  }
                  const shown = Math.min(VOTE_TABLE_PREVIEW, votes.length);
                  const prefix =
                    dataSource === "precomputed" ? "Analysed all" : "Analysing all";
                  return `${prefix} ${total.toLocaleString()} votes · showing first ${shown}`;
                })()}
              </small>
            </div>

            {votesStatus === "error" && (
              <div className="votes-error" role="alert">
                <strong>Votes unavailable</strong>
                <span>{votesError}</span>
              </div>
            )}

            {analysis && (
              <FlexGovAnalysis
                analysis={analysis}
                labels={proposal.choices}
                fullApproval={fullApproval}
                report={canonicalReport}
              />
            )}

            {votes.length > 0 && (
              <details className="support-disclosure ballot-disclosure">
                <summary>
                  <span>Sample ballots</span>
                  <strong>
                    {Math.min(VOTE_TABLE_PREVIEW, votes.length)} shown
                  </strong>
                </summary>
                <div className="votes-table-wrap">
                  <table className="votes-table">
                    <thead>
                      <tr>
                        <th>Voter</th>
                        <th>Choice</th>
                        <th>Voting power</th>
                        <th>Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {votes.slice(0, VOTE_TABLE_PREVIEW).map((vote) => (
                        <tr key={vote.id}>
                          <td>
                            <span title={vote.voter}>
                              {shortenAddress(vote.voter)}
                            </span>
                          </td>
                          <td>{formatChoice(vote.choice, proposal.choices)}</td>
                          <td>{formatVotingPower(vote.vp)}</td>
                          <td>{formatUnixTime(vote.created)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            )}
          </article>
        )}
      </div>
    </section>
  );
}

/**
 * Renders the engine's findings for the loaded proposal. Advisory framing only:
 * it reports measurements and comparisons, never a verdict of "attack".
 * Signals that need data Snapshot does not provide are named as unavailable
 * rather than omitted or shown as zero, preserving the report's audit trail.
 */
function FlexGovAnalysis({
  analysis,
  labels,
  fullApproval,
  report,
}: {
  analysis: EngineSnapshot;
  labels: readonly string[];
  fullApproval: ApprovalInterpretation | null;
  report: GovernanceHealthReport | null;
}) {
  const { signals, outcomes, robustness, alerts } = analysis;

  // Map a counterfactual choice key back to its human label where possible.
  const label = (key: string | null): string => {
    if (key === null) return "tie / none";
    const asIndex = Number(key);
    if (Number.isInteger(asIndex) && labels[asIndex - 1]) {
      return labels[asIndex - 1] as string;
    }
    return key;
  };

  return (
    <section className="flexgov-analysis" aria-live="polite">
      <header className="analysis-report-header">
        <div>
          <span className="analysis-eyebrow">FlexGov analysis report</span>
          <h4>How was this outcome shaped?</h4>
          <p>
            Concentration, timing and mechanism sensitivity across{" "}
            {analysis.voteIndex.toLocaleString()} ballots.
          </p>
        </div>
        <div className={`robustness-badge robustness-${robustness}`}>
          <span>Outcome robustness</span>
          <strong>{formatRobustness(robustness)}</strong>
        </div>
      </header>

      <div className="ballot-mode-row">
        <span>Ballot interpretation</span>
        <strong>First selection</strong>
        <span className="mode-future">
          Full approval ·{" "}
          {fullApproval?.status === "computed"
            ? "computed"
            : fullApproval?.status === "not-applicable"
              ? "not applicable"
              : "awaiting complete ballots"}
        </span>
        <p>
          First selection counts one option per ballot. For approval proposals,
          full approval separately counts every option that the voter selected.
        </p>
      </div>

      <div className="report-section-heading">
        <span>01</span>
        <div>
          <h5>Observable signals</h5>
          <p>Each measurement remains visible instead of becoming a black-box score.</p>
        </div>
      </div>

      <div className="flexgov-signals">
        <div className="signal-card">
          <dt>Top wallet share</dt>
          <dd>{formatPct(signals.whaleShare)}</dd>
          <small>Largest wallet&apos;s share of cast voting power</small>
        </div>
        <div className="signal-card">
          <dt>Top-3 share</dt>
          <dd>{formatPct(signals.top3Share)}</dd>
          <small>Combined share controlled by the three largest wallets</small>
        </div>
        <div className="signal-card">
          <dt>Concentration (Gini)</dt>
          <dd>{signals.gini.toFixed(3)}</dd>
          <small>0 is equal; values approaching 1 are highly concentrated</small>
        </div>
        <div className="signal-card">
          <dt>Wallets for 50%</dt>
          <dd>{signals.walletsFor50Pct}</dd>
          <small>Smallest coalition holding half of cast voting power</small>
        </div>
        {signals.lateWeightShare !== null && (
          <div className="signal-card">
            <dt>Weight arriving late</dt>
            <dd>{formatPct(signals.lateWeightShare)}</dd>
            <small>Voting power cast in the final 10% of the voting window</small>
          </div>
        )}
        <div className="signal-card timing-signal">
          <dt>Votes sharing a second</dt>
          <dd>{formatPct(signals.dupTimestampRatio)}</dd>
          <small>Wallets sharing an exact cast timestamp with another wallet</small>
          {/* Native details/summary keeps the methodology available by click
              and keyboard without letting a long caveat dominate the report. */}
          <details className="timing-method-note">
            <summary>How should this be interpreted?</summary>
            <div>
              {signals.expectedDupTimestampRatio != null &&
                signals.dupTimestampLift != null && (
                  <p>
                    The 24-hour global-flat reference would predict{" "}
                    {formatPct(signals.expectedDupTimestampRatio)}. The observed
                    rate is {signals.dupTimestampLift.toFixed(2)}× that baseline.
                  </p>
                )}
              {signals.dupTimestampSensitivity?.length > 0 && (
                // Show assumptions side by side because the maximally flat
                // reference can understate natural collisions during peak hours.
                <table className="timing-sensitivity-table">
                  <thead>
                    <tr>
                      <th>Reference assumption</th>
                      <th>Expected shared-second rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {signals.dupTimestampSensitivity.map((scenario) => (
                      <tr key={scenario.activeHoursPerDay}>
                        <td>
                          {scenario.activeHoursPerDay === 24
                            ? "Global-flat reference (24h)"
                            : `${scenario.activeHoursPerDay} active hours/day`}
                        </td>
                        <td>{formatPct(scenario.expectedRatio)}</td>
                      </tr>
                    ))}
                    <tr>
                      <td>Observed</td>
                      <td>{formatPct(signals.dupTimestampRatio)}</td>
                    </tr>
                  </tbody>
                </table>
              )}
              {signals.averageVotesPerDay != null && (
                <p>
                  Average activity:{" "}
                  {formatNumber(signals.averageVotesPerDay)} votes/day,{" "}
                  {formatNumber(signals.averageVotesPerHour ?? 0)} votes/hour,
                  and {formatNumber(signals.averageVotesPerMinute ?? 0)}{" "}
                  votes/minute.
                </p>
              )}
              <p>
                Timing correlation is worth inspecting, but does not establish
                common control or Sybil activity by itself.
              </p>
              <p>
                Global accessibility does not establish the electorate&apos;s
                geographic distribution or voting schedule. A later
                activity-adjusted baseline should preserve this proposal&apos;s
                observed hourly pattern without requiring location data.
              </p>
              <strong>To resist gaming, the eventual detector should combine:</strong>
              <ul>
                <li>Multiple time windows: 1, 5, 30 and 300 seconds</li>
                <li>Exact and near-similar approval/ranked ballots</li>
                <li>Voting-power similarity</li>
                <li>Unusually low ballot diversity inside a time cluster</li>
                <li>
                  Later: wallet age, funding links and historical behaviour
                </li>
              </ul>
            </div>
          </details>
        </div>
      </div>

      <div className="report-section-heading">
        <span>02</span>
        <div>
          <h5>Counterfactual comparison</h5>
          <p>Same first-selection ballots, transformed under different weighting rules.</p>
        </div>
      </div>

      <div className="flexgov-counterfactuals">
        <table>
          <thead>
            <tr>
              <th>Rule</th>
              <th>Weighting</th>
              <th>Winner</th>
              <th>Weight Gini</th>
            </tr>
          </thead>
          <tbody>
            {outcomes.map((o) => (
              <tr key={o.rule}>
                <td>
                  <strong>{o.rule}</strong>
                  <span>{ruleName(o.rule)}</span>
                </td>
                <td>{ruleMethod(o.rule)}</td>
                <td className="cf-winner">{label(o.winner)}</td>
                <td>{o.gini.toFixed(3)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {fullApproval?.status === "computed" &&
        fullApproval.outcomes &&
        fullApproval.robustness && (
          <section className="approval-comparison">
            <div className="approval-comparison-heading">
              <div>
                <span>Full approval interpretation</span>
                <h6>Every selected option counts</h6>
              </div>
              <div
                className={`robustness-badge robustness-${fullApproval.robustness}`}
              >
                <span>Outcome robustness</span>
                <strong>{formatRobustness(fullApproval.robustness)}</strong>
              </div>
            </div>
            <p>
              The same ballots and weighting transformations are used, but each
              approved option receives the ballot&apos;s full transformed weight.
            </p>
            <div className="flexgov-counterfactuals">
              <table>
                <thead>
                  <tr>
                    <th>Rule</th>
                    <th>Weighting</th>
                    <th>Winner</th>
                    <th>Weight Gini</th>
                  </tr>
                </thead>
                <tbody>
                  {fullApproval.outcomes.map((outcome) => (
                    <tr key={outcome.rule}>
                      <td>
                        <strong>{outcome.rule}</strong>
                        <span>{ruleName(outcome.rule)}</span>
                      </td>
                      <td>{ruleMethod(outcome.rule)}</td>
                      <td className="cf-winner">{label(outcome.winner)}</td>
                      <td>{outcome.gini.toFixed(3)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

      {fullApproval?.status === "planned" && (
        <p className="approval-unavailable">
          Full approval requires the complete ballot dataset. This saved report
          contains aggregates and a small evidence preview, so FlexGov does not
          calculate an electorate-wide result from the preview.
        </p>
      )}

      <div className="report-lower-grid">
        <section className="report-findings">
          <div className="report-section-heading compact">
            <span>03</span>
            <div>
              <h5>Threshold findings</h5>
            </div>
          </div>
          {alerts.length > 0 ? (
            <ul className="flexgov-alerts">
              {alerts.map((a) => (
                <li key={a.id} className={`alert-${a.severity}`}>
                  <span className="alert-signal">{a.signal}</span>
                  <span className="alert-message">{a.message}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="no-alerts">
              No configured final-state threshold fired. Timing concentration
              remains available above for inspection.
            </p>
          )}
        </section>

        <section className="data-availability">
          <div className="report-section-heading compact">
            <span>04</span>
            <div>
              <h5>Data availability</h5>
            </div>
          </div>
          <ul>
            <li>
              <span>Voting power and ballots</span>
              <strong>Available</strong>
            </li>
            <li>
              <span>Voting window and timing</span>
              <strong>Available</strong>
            </li>
            <li className="unavailable">
              <span>Eligible-member turnout</span>
              <strong>Unavailable from Snapshot</strong>
            </li>
            <li className="unavailable">
              <span>On-chain quorum progress</span>
              <strong>Unavailable from Snapshot</strong>
            </li>
            <li className="unavailable">
              <span>Historical wallet provenance</span>
              <strong>Not yet connected</strong>
            </li>
          </ul>
        </section>
      </div>

      {report && <ReportVerification report={report} />}
    </section>
  );
}

/**
 * Verification metadata stays collapsed until requested so the governance
 * findings remain primary while reproducibility details remain one click away.
 */
function ReportVerification({
  report,
}: {
  report: GovernanceHealthReport;
}) {
  const { methodology, source, verification } = report;
  return (
    <details className="report-verification">
      <summary>
        <span>
          <strong>Verify report</strong>
          <small>Hashes, methodology and attestation status</small>
        </span>
        <span aria-hidden="true">＋</span>
      </summary>
      <div className="verification-grid">
        <VerificationItem
          label="Report content hash"
          value={verification.reportHash}
          note="SHA-256 of canonical report content"
        />
        <VerificationItem
          label="Source-data hash"
          value={source.sourceDataHash}
          note={
            source.sourceDataHash
              ? "SHA-256 of the complete fetched ballot set"
              : "Full source archive was not retained for this saved analysis"
          }
        />
        <VerificationItem
          label="Configuration hash"
          value={methodology.configurationHash}
          note={
            methodology.configurationHash
              ? "Commits to the engine thresholds and settings"
              : "Configuration digest was not recorded when this report was generated"
          }
        />
        <VerificationItem
          label="Methodology"
          value={`${methodology.engineName} ${methodology.engineVersion} · ${methodology.analysisMode} · ${methodology.ballotInterpretation}`}
          note={
            methodology.engineCommit
              ? `Engine commit ${methodology.engineCommit}`
              : "Engine commit unavailable"
          }
        />
        <VerificationItem
          label="Storage reference"
          value={verification.storageUri}
          note="Not yet stored on content-addressed storage"
        />
        <VerificationItem
          label="On-chain attestation"
          value={verification.chainAttestation}
          note="No on-chain transaction has been submitted"
        />
      </div>
      <p>
        The report hash excludes this verification envelope, allowing storage
        and chain references to be attached later without changing the identity
        of the underlying analysis.
      </p>
    </details>
  );
}

function VerificationItem({
  label,
  value,
  note,
}: {
  label: string;
  value: string | null;
  note: string;
}) {
  return (
    <div className={!value ? "verification-unavailable" : undefined}>
      <span>{label}</span>
      <code>{value ?? "Unavailable"}</code>
      <small>{note}</small>
    </div>
  );
}

function ruleName(rule: string): string {
  const names: Record<string, string> = {
    "1T1V": "Token weighted",
    QV: "Quadratic",
    "1W1V": "One wallet, one vote",
    GININORM: "Gini normalised",
  };
  return names[rule] ?? rule;
}

function ruleMethod(rule: string): string {
  const methods: Record<string, string> = {
    "1T1V": "Cast voting power",
    QV: "Square root of voting power",
    "1W1V": "One unit per wallet",
    GININORM: "Inequality-adjusted power",
  };
  return methods[rule] ?? "Configured transformation";
}

function formatRobustness(
  robustness: EngineSnapshot["robustness"],
): string {
  if (robustness === "n/a") return "Not available";
  return robustness.replace("-", " ");
}

/** Snapshot timestamps are Unix seconds; JavaScript dates use milliseconds. */
function formatUnixDate(timestamp: number): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(timestamp * 1_000));
}

/** Preserve the full wallet in the title while keeping the table compact. */
function shortenAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

/** Choice indexes are 1-based in Snapshot, so index 1 maps to choices[0]. */
function formatChoice(
  choice: SnapshotChoice,
  labels: readonly string[],
): string {
  if (typeof choice === "number") {
    return labels[choice - 1] ?? `Choice ${choice}`;
  }

  if (Array.isArray(choice)) {
    return choice
      .map((index) => labels[index - 1] ?? `Choice ${index}`)
      .join(", ");
  }

  return Object.entries(choice)
    .map(([index, weight]) => {
      const label = labels[Number(index) - 1] ?? `Choice ${index}`;
      return `${label} (${weight}%)`;
    })
    .join(", ");
}

function formatVotingPower(votingPower: number): string {
  return new Intl.NumberFormat("en-GB", {
    maximumFractionDigits: 3,
  }).format(votingPower);
}

/** Render a [0,1] share as a percentage; extra precision for tiny shares. */
function formatPct(value: number): string {
  const digits = value >= 0.1 ? 1 : 3;
  return `${(value * 100).toFixed(digits)}%`;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-GB", {
    maximumFractionDigits: 1,
  }).format(value);
}

function formatUnixTime(timestamp: number): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  }).format(new Date(timestamp * 1_000));
}
