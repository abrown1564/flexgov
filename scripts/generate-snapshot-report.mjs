#!/usr/bin/env node

/**
 * Generate one pinned canonical Governance Health Report from Snapshot Hub.
 *
 * Usage:
 *   node scripts/generate-snapshot-report.mjs <space> <dao-name> <proposal-id> <output>
 *
 * This is intentionally a repeatable generator rather than a hand-authored
 * fixture. It fetches the complete ballot set, hashes the source/configuration,
 * runs the same engine as the browser, then hashes the canonical report content.
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

const SNAPSHOT_HUB_ENDPOINT = "https://hub.snapshot.org/graphql";
const PAGE_SIZE = 1000;
const EVIDENCE_PREVIEW_SIZE = 10;

const [, , space, daoName, proposalId, outputArgument] = process.argv;

if (!space || !daoName || !proposalId || !outputArgument) {
  throw new Error(
    "Usage: generate-snapshot-report.mjs <space> <dao-name> <proposal-id> <output>",
  );
}

const outputPath = resolve(outputArgument);

const PROPOSAL_QUERY = `
  query Proposal($id: String!) {
    proposal(id: $id) {
      id
      title
      state
      choices
      type
      votes
      start
      end
    }
  }
`;

const VOTES_QUERY = `
  query Votes($proposalId: String!, $createdGte: Int!) {
    votes(
      first: ${PAGE_SIZE}
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

async function querySnapshot(query, variables) {
  const response = await fetch(SNAPSHOT_HUB_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error(`Snapshot Hub returned HTTP ${response.status}.`);
  }

  const result = await response.json();
  if (result.errors?.length) {
    throw new Error(result.errors.map(({ message }) => message).join("; "));
  }
  return result.data;
}

function mapVoteType(type) {
  switch (type) {
    case "single-choice":
      return "single";
    case "basic":
      return "basic";
    case "approval":
      return "approval";
    case "ranked-choice":
      return "ranked";
    case "weighted":
      return "weighted";
    case "quadratic":
      return "quadratic";
    default:
      return null;
  }
}

async function fetchAllVotes(id) {
  const ballots = [];
  const seen = new Set();
  let createdGte = 0;

  while (true) {
    const data = await querySnapshot(VOTES_QUERY, {
      proposalId: id,
      createdGte,
    });
    const page = data?.votes ?? [];
    if (page.length === 0) break;

    let added = 0;
    for (const ballot of page) {
      if (!seen.has(ballot.id)) {
        seen.add(ballot.id);
        ballots.push(ballot);
        added += 1;
      }
    }

    if (page.length < PAGE_SIZE) break;
    if (added === 0) {
      // Cursor pagination cannot advance if an entire page shares one second.
      // Failing loudly is safer than publishing an apparently complete report.
      throw new Error(
        `Pagination stalled at timestamp ${createdGte}; report not generated.`,
      );
    }
    createdGte = page.at(-1).created;
  }

  return ballots;
}

const proposalData = await querySnapshot(PROPOSAL_QUERY, { id: proposalId });
const proposal = proposalData?.proposal;
if (!proposal) throw new Error(`Snapshot proposal ${proposalId} was not found.`);
if (proposal.state !== "closed") {
  throw new Error("Precomputed reports must pin a closed proposal.");
}

const voteType = mapVoteType(proposal.type);
if (!voteType) {
  throw new Error(
    `Snapshot vote type "${proposal.type}" is not supported by the engine.`,
  );
}

const ballots = await fetchAllVotes(proposal.id);
if (ballots.length !== proposal.votes) {
  throw new Error(
    `Fetched ${ballots.length} ballots but Snapshot reports ${proposal.votes}.`,
  );
}

const events = ballots.map((ballot) => ({
  voter: ballot.voter,
  weight: ballot.vp,
  choice: ballot.choice,
  timestamp: ballot.created,
}));
const proposalContext = {
  id: proposal.id,
  title: proposal.title,
  start: proposal.start,
  end: proposal.end,
  voteType,
  choices: proposal.choices,
};
const analysis = analyze(proposalContext, events);

// Sorting by vote ID gives the source digest a stable order independent of how
// Snapshot pages were returned during this particular retrieval.
const sourceDataHash = await sha256Hex(
  canonicalJson([...ballots].sort((a, b) => a.id.localeCompare(b.id))),
);
const configurationHash = await sha256Hex(canonicalJson(DEFAULT_CONFIG));
const generatedAt = new Date().toISOString();

const report = buildGovernanceHealthReport({
  reportId: `snapshot:${space}:${proposal.id}`,
  generatedAt,
  subject: {
    governanceSystem: "snapshot",
    daoName,
    spaceOrDaoId: space,
    proposalId: proposal.id,
    title: proposal.title,
    state: proposal.state,
    voteType,
    choices: proposal.choices,
    votingWindow: { start: proposal.start, end: proposal.end },
  },
  source: {
    provider: "Snapshot Hub API",
    endpoint: SNAPSHOT_HUB_ENDPOINT,
    retrievalMode: "precomputed",
    retrievedAt: generatedAt,
    voteCount: ballots.length,
    sourceDataHash,
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
  limitations: [
    "Batch final-state analysis does not run the stream engine's historical Sybil or collusion cluster detectors.",
    "The complete source archive is committed by hash but is not embedded in this compact report.",
  ],
  evidencePreview: {
    ballots: ballots.slice(0, EVIDENCE_PREVIEW_SIZE).map((ballot) => ({
      id: ballot.id,
      voter: ballot.voter,
      votingPower: ballot.vp,
      choice: ballot.choice,
      created: ballot.created,
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
      title: proposal.title,
      voteType,
      voteCount: ballots.length,
      sourceDataHash,
      configurationHash,
      reportHash,
    },
    null,
    2,
  ),
);
