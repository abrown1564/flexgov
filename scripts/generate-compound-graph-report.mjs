#!/usr/bin/env node

/**
 * Generate the pinned Compound proposal 393 Governance Health Report.
 *
 * The Graph API key is read only from THE_GRAPH_API_KEY and is used solely to
 * construct the server-side request URL. Neither the secret-bearing URL nor
 * the key is written to the report or printed to stdout.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
  DEFAULT_CONFIG,
  analyze,
  buildGovernanceHealthReport,
  canonicalJson,
  hashGovernanceHealthReport,
  sha256Hex,
} from "../engine/dist/index.js";

const SUBGRAPH_ID = "7nuSuPhUgKSg5uKRh8g5jyjZWE8DnvQw1mQtvDWpxrnh";
const NETWORK = "ethereum-mainnet";
const PROPOSAL_ID = "393";
const EXPECTED_GOVERNOR =
  "0xc0da02939e1441f497fd74f78ce7decb17b66529";
const API_KEY = process.env.THE_GRAPH_API_KEY;
const outputPath = resolve(
  process.argv[2] ??
    "landing-page/app/data/compound-393-health-report.json",
);

if (!API_KEY) {
  throw new Error(
    "THE_GRAPH_API_KEY is required. Keep it in engine/.env and use the package generation command.",
  );
}

const gatewayEndpoint =
  `https://gateway.thegraph.com/api/${API_KEY}/subgraphs/id/${SUBGRAPH_ID}`;
const publicSourceEndpoint =
  `https://thegraph.com/explorer/subgraphs/${SUBGRAPH_ID}`;

async function queryGraph(query, variables = {}) {
  const response = await fetch(gatewayEndpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error(`The Graph gateway returned HTTP ${response.status}.`);
  }

  const result = await response.json();
  if (result.errors?.length) {
    // GraphQL errors are safe to report because the request URL containing the
    // key is never included in this message.
    throw new Error(result.errors.map(({ message }) => message).join("; "));
  }
  return result.data;
}

const PROPOSAL_QUERY = `
  query CompoundProposal($id: ID!) {
    proposal(id: $id) {
      id
      txnHash
      description
      state
      quorumVotes
      totalDelegateVotes
      creationBlock
      creationTime
      startBlock
      endBlock
      queueTxnHash
      queueBlock
      queueTime
      executionETA
      executionTxnHash
      executionBlock
      executionTime
      targets
      values
      signatures
      governanceFramework {
        type
        contractAddress
        tokenAddress
        timelockAddress
      }
      proposer { id }
      votes(first: 1000, orderBy: blockTimeId, orderDirection: asc) {
        id
        choice
        weight
        voter { id }
        block
        blockTime
        txnHash
        logIndex
      }
    }
    _meta {
      block { number hash timestamp }
      deployment
      hasIndexingErrors
    }
  }
`;

const data = await queryGraph(PROPOSAL_QUERY, { id: PROPOSAL_ID });
const proposal = data?.proposal;
if (!proposal) throw new Error(`Compound proposal ${PROPOSAL_ID} was not found.`);
if (proposal.state !== "EXECUTED") {
  throw new Error(`Expected executed proposal 393, received ${proposal.state}.`);
}
if (proposal.governanceFramework.contractAddress !== EXPECTED_GOVERNOR) {
  throw new Error("The indexed proposal does not belong to the validated Governor.");
}
if (proposal.votes.length !== Number(proposal.totalDelegateVotes)) {
  // Proposal 393 has only 29 votes. This explicit guard prevents a future
  // schema/query change from silently turning the pinned report into a sample.
  throw new Error(
    `Fetched ${proposal.votes.length} votes but proposal reports ${proposal.totalDelegateVotes}.`,
  );
}

// This deployment exposes authoritative proposal blocks and lifecycle times,
// but historical `_meta.block.timestamp` is null. Interpolate only the UI/engine
// window between the indexed creation and queue anchors; retain the exact start
// and end blocks in governanceContext so this derivation is never mistaken for
// an on-chain timestamp.
const secondsPerBlock =
  (Number(proposal.queueTime) - Number(proposal.creationTime)) /
  (Number(proposal.queueBlock) - Number(proposal.creationBlock));
const interpolateTime = (block) =>
  Math.round(
    Number(proposal.creationTime) +
      (Number(block) - Number(proposal.creationBlock)) * secondsPerBlock,
  );
const start = interpolateTime(proposal.startBlock);
const end = interpolateTime(proposal.endBlock);

/** Compound stores COMP voting weight with 18 decimals; engine units are COMP. */
function compFromWei(value) {
  const digits = BigInt(value).toString().padStart(19, "0");
  const whole = digits.slice(0, -18);
  const fraction = digits.slice(-18).replace(/0+$/, "");
  return Number(fraction ? `${whole}.${fraction}` : whole);
}

const choiceLabels = {
  AGAINST: "Against",
  FOR: "For",
  ABSTAIN: "Abstain",
};
const ballots = proposal.votes.map((vote) => {
  const choice = choiceLabels[vote.choice];
  if (!choice) throw new Error(`Unsupported Governor vote choice ${vote.choice}.`);
  return {
    id: vote.id,
    voter: vote.voter.id,
    weight: compFromWei(vote.weight),
    choice,
    timestamp: Number(vote.blockTime),
    transactionHash: vote.txnHash,
    blockNumber: Number(vote.block),
    logIndex: Number(vote.logIndex),
  };
});
const events = ballots.map(({ voter, weight, choice, timestamp }) => ({
  voter,
  weight,
  choice,
  timestamp,
}));
const quorumVotes = compFromWei(proposal.quorumVotes);
const analysis = analyze(
  {
    id: proposal.id,
    title: proposal.description.split("\n")[0].replace(/^#+\s*/, "").trim(),
    start,
    end,
    voteType: "basic",
    choices: ["Against", "For", "Abstain"],
    quorumTarget: quorumVotes,
  },
  events,
);

// Hash the complete normalized source record, including transaction and block
// provenance, rather than the compact ballot preview embedded in the report.
const normalizedSource = {
  proposal: {
    ...proposal,
    votes: undefined,
  },
  ballots,
  graphMeta: data._meta,
  votingWindowBlocks: {
    start: proposal.startBlock,
    end: proposal.endBlock,
    timestampMethod: "interpolated-from-creation-and-queue",
  },
};
const sourceDataHash = await sha256Hex(canonicalJson(normalizedSource));
const configurationHash = await sha256Hex(canonicalJson(DEFAULT_CONFIG));
const generatedAt = new Date().toISOString();
const governor = proposal.governanceFramework;

const report = buildGovernanceHealthReport({
  reportId: `the-graph:compound-governor:${proposal.id}`,
  generatedAt,
  subject: {
    governanceSystem: "evm-governor",
    daoName: "Compound",
    spaceOrDaoId: governor.contractAddress,
    proposalId: proposal.id,
    title: analysis.proposal.title ?? `Compound proposal ${proposal.id}`,
    state: proposal.state,
    voteType: "basic",
    choices: ["Against", "For", "Abstain"],
    votingWindow: { start, end },
  },
  source: {
    provider: "The Graph",
    endpoint: publicSourceEndpoint,
    retrievalMode: "precomputed",
    retrievedAt: generatedAt,
    voteCount: ballots.length,
    sourceDataHash,
    graphProvenance: {
      subgraphId: SUBGRAPH_ID,
      network: NETWORK,
      governorAddress: governor.contractAddress,
      deploymentId: data._meta?.deployment ?? null,
      indexedBlockNumber: data._meta?.block?.number ?? null,
      indexedBlockHash: data._meta?.block?.hash ?? null,
      hasIndexingErrors: data._meta?.hasIndexingErrors ?? null,
    },
  },
  governanceContext: {
    network: NETWORK,
    governorType: governor.type,
    governorAddress: governor.contractAddress,
    tokenAddress: governor.tokenAddress,
    timelockAddress: governor.timelockAddress,
    proposerAddress: proposal.proposer.id,
    quorumVotes,
    lifecycle: {
      creationTransaction: proposal.txnHash,
      creationBlock: Number(proposal.creationBlock),
      votingStartBlock: Number(proposal.startBlock),
      votingEndBlock: Number(proposal.endBlock),
      queuedTransaction: proposal.queueTxnHash,
      queuedBlock: proposal.queueBlock ? Number(proposal.queueBlock) : null,
      queuedAt: proposal.queueTime ? Number(proposal.queueTime) : null,
      executionEta: proposal.executionETA
        ? Number(proposal.executionETA)
        : null,
      executionTransaction: proposal.executionTxnHash,
      executionBlock: proposal.executionBlock
        ? Number(proposal.executionBlock)
        : null,
      executedAt: proposal.executionTime
        ? Number(proposal.executionTime)
        : null,
    },
    actions: proposal.targets.map((target, index) => ({
      target,
      valueWei: proposal.values[index] ?? "0",
      signature: proposal.signatures[index] ?? "unknown",
    })),
  },
  methodology: {
    analysisMode: "batch-final-state",
    configurationHash,
  },
  snapshot: analysis,
  ballotEvents: events,
  dataAvailability: [
    {
      id: "ballots",
      label: "On-chain voting power and individual ballots",
      status: "available",
      reason: null,
    },
    {
      id: "timing",
      label: "Voting blocks, timestamps and transactions",
      status: "available",
      reason:
        "Start/end blocks are authoritative; display timestamps are interpolated from indexed creation and queue anchors.",
    },
    {
      id: "quorum",
      label: "Authoritative Governor quorum",
      status: "available",
      reason: null,
    },
    {
      id: "execution",
      label: "Queue and execution lifecycle",
      status: "available",
      reason: null,
    },
    {
      id: "actions",
      label: "Contract targets and function signatures",
      status: "available",
      reason: null,
    },
    {
      id: "forum",
      label: "Forum discussion context",
      status: "not-connected",
      reason: "The Governor subgraph indexes on-chain execution, not forum activity.",
    },
  ],
  limitations: [
    "Batch final-state analysis does not run the stream engine's historical Sybil or collusion cluster detectors.",
    "Contract signatures and targets are surfaced without asserting the intent or safety of the called actions.",
    "Voting-window timestamps are derived from authoritative Graph-indexed blocks and lifecycle time anchors because this deployment does not expose historical block timestamps.",
    "Wallet age, funding links and token-acquisition history are not connected.",
  ],
  evidencePreview: {
    ballots: ballots.slice(0, 10).map((ballot) => ({
      id: ballot.id,
      voter: ballot.voter,
      votingPower: ballot.weight,
      choice: ["Against", "For", "Abstain"].indexOf(ballot.choice) + 1,
      created: ballot.timestamp,
    })),
  },
});

const reportHash = await hashGovernanceHealthReport(report);
const verifiedReport = {
  ...report,
  verification: { ...report.verification, reportHash },
};

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(verifiedReport, null, 2)}\n`);

console.log(
  JSON.stringify(
    {
      outputPath,
      proposalId: proposal.id,
      voteCount: ballots.length,
      subgraphId: SUBGRAPH_ID,
      indexedBlock: data._meta?.block?.number ?? null,
      sourceDataHash,
      configurationHash,
      reportHash,
    },
    null,
    2,
  ),
);
