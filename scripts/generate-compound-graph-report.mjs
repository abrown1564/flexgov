#!/usr/bin/env node

/**
 * Generate a canonical FlexGov report for a supported Compound Governor vote.
 *
 * This is intentionally a server-side CLI. THE_GRAPH_API_KEY is used only to
 * authenticate the outbound gateway request; neither the secret-bearing URL
 * nor the key is returned, logged, written to the report, or bundled for the
 * browser.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  DEFAULT_CONFIG,
  analyze,
  buildGovernanceHealthReport,
  canonicalJson,
  hashGovernanceHealthReport,
  sha256Hex,
} from "../engine/dist/index.js";

export const COMPOUND_SUBGRAPH_ID =
  "7nuSuPhUgKSg5uKRh8g5jyjZWE8DnvQw1mQtvDWpxrnh";
export const COMPOUND_NETWORK = "ethereum-mainnet";
export const COMPOUND_GOVERNOR =
  "0xc0da02939e1441f497fd74f78ce7decb17b66529";
export const DEFAULT_PROPOSAL_ID = "393";
export const DEFAULT_OUTPUT =
  "landing-page/app/data/compound-393-health-report.json";
export const GRAPH_PAGE_SIZE = 1000;

const publicSourceEndpoint =
  `https://thegraph.com/explorer/subgraphs/${COMPOUND_SUBGRAPH_ID}`;

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
    }
    _meta {
      block { number hash timestamp }
      deployment
      hasIndexingErrors
    }
  }
`;

const VOTES_QUERY = `
  query CompoundVotes($proposalId: String!, $cursor: ID!, $pageSize: Int!) {
    votes(
      first: $pageSize
      where: { proposal: $proposalId, id_gt: $cursor }
      orderBy: id
      orderDirection: asc
    ) {
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
`;

/** Parse a deliberately small CLI surface; unknown options fail immediately. */
export function parseCliArgs(argv, cwd = process.cwd()) {
  let proposalId = DEFAULT_PROPOSAL_ID;
  let output = DEFAULT_OUTPUT;
  let help = false;
  const positionals = [];

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help" || argument === "-h") {
      help = true;
    } else if (argument === "--proposal" || argument === "-p") {
      proposalId = argv[++index];
      if (!proposalId) throw new Error(`${argument} requires a proposal ID.`);
    } else if (argument === "--output" || argument === "-o") {
      output = argv[++index];
      if (!output) throw new Error(`${argument} requires an output path.`);
    } else if (argument.startsWith("-")) {
      throw new Error(`Unknown option: ${argument}`);
    } else {
      positionals.push(argument);
    }
  }

  // Preserve the original command's one-positional output path while steering
  // new callers toward explicit --proposal/--output flags.
  if (positionals.length === 1) output = positionals[0];
  if (positionals.length > 1) {
    throw new Error(
      "Use --proposal <id> --output <path>; only one legacy output positional is supported.",
    );
  }
  if (!/^\d+$/.test(proposalId)) {
    throw new Error("Compound proposal ID must contain decimal digits only.");
  }

  return { proposalId, outputPath: resolve(cwd, output), help };
}

export function usage() {
  return [
    "Usage:",
    "  node --env-file=engine/.env scripts/generate-compound-graph-report.mjs \\",
    "    --proposal <compound-proposal-id> --output <report.json>",
    "",
    `Defaults: --proposal ${DEFAULT_PROPOSAL_ID} --output ${DEFAULT_OUTPUT}`,
    "Supported source: validated Compound Governor Bravo subgraph on Ethereum mainnet.",
  ].join("\n");
}

/**
 * Create a secret-safe GraphQL client.
 *
 * Network failures are rewritten rather than rethrowing fetch errors because
 * some runtimes include the requested URL—and therefore its API key—in error
 * messages or causes.
 */
export function createGraphClient(apiKey, fetchImpl = fetch) {
  if (!apiKey) throw new Error("THE_GRAPH_API_KEY is required.");
  const gateway =
    `https://gateway.thegraph.com/api/${apiKey}/subgraphs/id/${COMPOUND_SUBGRAPH_ID}`;

  return async function queryGraph(query, variables = {}) {
    let response;
    try {
      response = await fetchImpl(gateway, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query, variables }),
      });
    } catch {
      throw new Error("The Graph gateway request failed before a response.");
    }

    if (!response.ok) {
      throw new Error(`The Graph gateway returned HTTP ${response.status}.`);
    }

    const result = await response.json();
    if (result.errors?.length) {
      throw new Error(result.errors.map(({ message }) => message).join("; "));
    }
    return result.data;
  };
}

/**
 * Fetch every ballot with an immutable ID cursor.
 *
 * `skip` pagination is capped by Graph nodes and nested `first: 1000` can
 * silently truncate. Advancing on `id_gt` makes completeness testable against
 * the proposal's indexed `totalDelegateVotes`.
 */
export async function fetchAllVotes(
  proposalId,
  queryGraph,
  pageSize = GRAPH_PAGE_SIZE,
) {
  const votes = [];
  let cursor = "";

  while (true) {
    const data = await queryGraph(VOTES_QUERY, {
      proposalId,
      cursor,
      pageSize,
    });
    const page = data?.votes ?? [];
    if (!Array.isArray(page)) {
      throw new Error("The Graph returned an unsupported votes payload.");
    }
    if (page.length > pageSize) {
      throw new Error("The Graph returned more votes than the requested page size.");
    }
    if (page.length === 0) break;

    const nextCursor = page.at(-1)?.id;
    if (!nextCursor || nextCursor <= cursor) {
      throw new Error("Vote pagination stalled; refusing a potentially truncated report.");
    }
    votes.push(...page);
    cursor = nextCursor;
    if (page.length < pageSize) break;
  }

  return votes;
}

/** Reject incompatible or incomplete source data before running the engine. */
export function assertSupportedProposal(proposal, votes) {
  if (!proposal) throw new Error("Compound proposal was not found.");
  if (proposal.governanceFramework?.contractAddress !== COMPOUND_GOVERNOR) {
    throw new Error("Proposal does not belong to the validated Compound Governor.");
  }
  if (!proposal.queueBlock || !proposal.queueTime) {
    throw new Error(
      "This proposal has no indexed queue anchor; safe voting-window normalization is unsupported.",
    );
  }
  if (!Array.isArray(proposal.targets) ||
      proposal.targets.length !== proposal.values?.length ||
      proposal.targets.length !== proposal.signatures?.length) {
    throw new Error("Proposal action arrays are incomplete or incompatible.");
  }

  const expectedVotes = Number(proposal.totalDelegateVotes);
  if (!Number.isSafeInteger(expectedVotes) || expectedVotes < 0) {
    throw new Error("Proposal vote total is not a supported integer.");
  }
  if (votes.length !== expectedVotes) {
    throw new Error(
      `Fetched ${votes.length} votes but proposal reports ${expectedVotes}; refusing truncated output.`,
    );
  }
}

/** Compound stores COMP voting weights as 18-decimal fixed-point integers. */
export function compFromWei(value) {
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

/**
 * Convert validated Graph entities into the canonical report.
 *
 * The engine is deterministic and receives normalized ballots only. Retrieval
 * and provenance are recorded separately so downstream agents can distinguish
 * indexed facts from FlexGov calculations.
 */
export async function buildCompoundReport({
  proposal,
  votes,
  graphMeta,
  retrievedAt,
}) {
  assertSupportedProposal(proposal, votes);

  // This subgraph exposes authoritative lifecycle blocks/times but historical
  // `_meta.block.timestamp` is null. Interpolation is limited to the engine's
  // display window; exact start/end blocks remain canonical Governor evidence.
  const secondsPerBlock =
    (Number(proposal.queueTime) - Number(proposal.creationTime)) /
    (Number(proposal.queueBlock) - Number(proposal.creationBlock));
  if (!Number.isFinite(secondsPerBlock) || secondsPerBlock <= 0) {
    throw new Error("Proposal lifecycle anchors cannot define a voting window.");
  }
  const interpolateTime = (block) =>
    Math.round(
      Number(proposal.creationTime) +
        (Number(block) - Number(proposal.creationBlock)) * secondsPerBlock,
    );
  const start = interpolateTime(proposal.startBlock);
  const end = interpolateTime(proposal.endBlock);
  if (end <= start) throw new Error("Normalized voting window is invalid.");

  const ballots = votes.map((vote) => {
    const choice = choiceLabels[vote.choice];
    if (!choice) {
      throw new Error(`Unsupported Governor vote choice ${vote.choice}.`);
    }
    const weight = compFromWei(vote.weight);
    const timestamp = Number(vote.blockTime);
    if (!Number.isFinite(weight) || weight < 0 || !Number.isInteger(timestamp)) {
      throw new Error(`Vote ${vote.id} contains unsupported numeric data.`);
    }
    return {
      id: vote.id,
      voter: vote.voter?.id,
      weight,
      choice,
      timestamp,
      transactionHash: vote.txnHash,
      blockNumber: Number(vote.block),
      logIndex: Number(vote.logIndex),
    };
  });
  if (ballots.some((ballot) => !ballot.id || !ballot.voter)) {
    throw new Error("One or more ballots lack stable identity fields.");
  }

  const events = ballots.map(({ voter, weight, choice, timestamp }) => ({
    voter,
    weight,
    choice,
    timestamp,
  }));
  const title =
    proposal.description.split("\n")[0].replace(/^#+\s*/, "").trim() ||
    `Compound proposal ${proposal.id}`;
  const quorumVotes = compFromWei(proposal.quorumVotes);
  const analysis = analyze(
    {
      id: proposal.id,
      title,
      start,
      end,
      voteType: "basic",
      choices: ["Against", "For", "Abstain"],
      quorumTarget: quorumVotes,
    },
    events,
  );

  const normalizedSource = {
    proposal,
    ballots,
    graphMeta,
    votingWindowBlocks: {
      start: proposal.startBlock,
      end: proposal.endBlock,
      timestampMethod: "interpolated-from-creation-and-queue",
    },
  };
  const sourceDataHash = await sha256Hex(canonicalJson(normalizedSource));
  const configurationHash = await sha256Hex(canonicalJson(DEFAULT_CONFIG));
  const governor = proposal.governanceFramework;

  const report = buildGovernanceHealthReport({
    reportId: `the-graph:compound-governor:${proposal.id}`,
    generatedAt: retrievedAt,
    subject: {
      governanceSystem: "evm-governor",
      daoName: "Compound",
      spaceOrDaoId: governor.contractAddress,
      proposalId: proposal.id,
      title,
      state: proposal.state,
      voteType: "basic",
      choices: ["Against", "For", "Abstain"],
      votingWindow: { start, end },
    },
    source: {
      provider: "The Graph",
      endpoint: publicSourceEndpoint,
      retrievalMode: "precomputed",
      retrievedAt,
      voteCount: ballots.length,
      sourceDataHash,
      graphProvenance: {
        subgraphId: COMPOUND_SUBGRAPH_ID,
        network: COMPOUND_NETWORK,
        governorAddress: governor.contractAddress,
        deploymentId: graphMeta?.deployment ?? null,
        indexedBlockNumber: graphMeta?.block?.number ?? null,
        indexedBlockHash: graphMeta?.block?.hash ?? null,
        hasIndexingErrors: graphMeta?.hasIndexingErrors ?? null,
      },
    },
    governanceContext: {
      network: COMPOUND_NETWORK,
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
        queuedBlock: Number(proposal.queueBlock),
        queuedAt: Number(proposal.queueTime),
        executionEta: proposal.executionETA
          ? Number(proposal.executionETA)
          : null,
        executionTransaction: proposal.executionTxnHash ?? null,
        executionBlock: proposal.executionBlock
          ? Number(proposal.executionBlock)
          : null,
        executedAt: proposal.executionTime
          ? Number(proposal.executionTime)
          : null,
      },
      actions: proposal.targets.map((target, index) => ({
        target,
        valueWei: proposal.values[index],
        signature: proposal.signatures[index],
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
        reason:
          "The Governor subgraph indexes on-chain execution, not forum activity.",
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
  return {
    ...report,
    verification: { ...report.verification, reportHash },
  };
}

/** End-to-end live generation entry point reusable by other Node agents. */
export async function generateCompoundReport({
  proposalId,
  outputPath,
  apiKey,
  queryGraph = createGraphClient(apiKey),
  now = () => new Date(),
}) {
  const proposalData = await queryGraph(PROPOSAL_QUERY, { id: proposalId });
  const votes = await fetchAllVotes(proposalId, queryGraph);
  const report = await buildCompoundReport({
    proposal: proposalData?.proposal,
    votes,
    graphMeta: proposalData?._meta,
    retrievedAt: now().toISOString(),
  });

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
  return report;
}

async function main() {
  const options = parseCliArgs(process.argv.slice(2));
  if (options.help) {
    console.log(usage());
    return;
  }

  const report = await generateCompoundReport({
    ...options,
    apiKey: process.env.THE_GRAPH_API_KEY,
  });
  console.log(
    JSON.stringify(
      {
        outputPath: options.outputPath,
        proposalId: report.subject.proposalId,
        voteCount: report.source.voteCount,
        subgraphId: report.source.graphProvenance.subgraphId,
        indexedBlock: report.source.graphProvenance.indexedBlockNumber,
        sourceDataHash: report.source.sourceDataHash,
        configurationHash: report.methodology.configurationHash,
        reportHash: report.verification.reportHash,
      },
      null,
      2,
    ),
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  await main();
}
