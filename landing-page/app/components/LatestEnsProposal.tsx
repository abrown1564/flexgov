"use client";

import { useRef, useState } from "react";

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
    }
  }
`;

// Votes are requested oldest-first so the table reflects proposal chronology.
const PROPOSAL_VOTES_QUERY = `
  query ProposalVotes($proposalId: String!) {
    votes(
      first: 10
      where: { proposal: $proposalId }
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

  async function fetchProposalVotes() {
    if (!proposal) return;

    setVotesStatus("loading");
    setVotesError("");

    try {
      const response = await fetch(SNAPSHOT_HUB_ENDPOINT, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          query: PROPOSAL_VOTES_QUERY,
          variables: { proposalId: proposal.id },
        }),
      });

      if (!response.ok) {
        throw new Error(`Snapshot returned HTTP ${response.status}`);
      }

      const result = (await response.json()) as VoteQueryResponse;
      if (result.errors?.length) {
        throw new Error(result.errors.map(({ message }) => message).join("; "));
      }

      setVotes(result.data?.votes ?? []);
      setVotesStatus("idle");
    } catch (caught) {
      setVotes([]);
      setVotesStatus("error");
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
          Explore the latest
          <br />
          <em>{selectedDao.name} proposal.</em>
        </h2>
        <p>
          Inspect its choices, participation, status, and voting window using
          current governance data.
        </p>
        <button
          className="live-data-button"
          type="button"
          // Wrap the call so React's click event is not mistaken for a DAO.
          onClick={() => void fetchLatestProposal()}
          disabled={status === "loading"}
        >
          {status === "loading"
            ? "Fetching…"
            : `Fetch latest ${selectedDao.name} proposal`}
          <span aria-hidden="true">→</span>
        </button>
      </div>

      <div className="proposal-panel" aria-live="polite">
        <div className="proposal-panel-bar">
          <span>Source</span>
          <strong>Snapshot Hub</strong>
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
            <div className="proposal-choices">
              <span>Available choices</span>
              <ul>
                {proposal.choices.map((choice) => (
                  <li key={choice}>{choice}</li>
                ))}
              </ul>
            </div>

            <div className="proposal-votes-action">
              <button
                type="button"
                onClick={fetchProposalVotes}
                disabled={votesStatus === "loading"}
              >
                {votesStatus === "loading" ? "Loading votes…" : "Load votes"}
                <span aria-hidden="true">↓</span>
              </button>
              <small>First 10 votes</small>
            </div>

            {votesStatus === "error" && (
              <div className="votes-error" role="alert">
                <strong>Votes unavailable</strong>
                <span>{votesError}</span>
              </div>
            )}

            {votes.length > 0 && (
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
                    {votes.map((vote) => (
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
            )}
          </article>
        )}
      </div>
    </section>
  );
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
