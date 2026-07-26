import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  COMPOUND_GOVERNOR,
  COMPOUND_SUBGRAPH_ID,
  assertSupportedProposal,
  buildCompoundReport,
  createGraphClient,
  fetchAllVotes,
  parseCliArgs,
} from "./generate-compound-graph-report.mjs";
import {
  hashGovernanceHealthReport,
} from "../engine/dist/index.js";

const proposal = {
  id: "393",
  txnHash: "0xcreate",
  description: "# Test Compound proposal\n\nBody",
  state: "EXECUTED",
  quorumVotes: "400000000000000000000000",
  totalDelegateVotes: "2",
  creationBlock: "100",
  creationTime: "1000",
  startBlock: "110",
  endBlock: "190",
  queueTxnHash: "0xqueue",
  queueBlock: "200",
  queueTime: "2200",
  executionETA: "3000",
  executionTxnHash: "0xexecute",
  executionBlock: "210",
  executionTime: "3200",
  targets: ["0xtarget"],
  values: ["0"],
  signatures: ["setValue()"],
  governanceFramework: {
    type: "GovernorBravo",
    contractAddress: COMPOUND_GOVERNOR,
    tokenAddress: "0xtoken",
    timelockAddress: "0xtimelock",
  },
  proposer: { id: "0xproposer" },
};

const votes = [
  {
    id: "a-393",
    choice: "FOR",
    weight: "300000000000000000000000",
    voter: { id: "0xa" },
    block: "120",
    blockTime: "1240",
    txnHash: "0xvote-a",
    logIndex: "1",
  },
  {
    id: "b-393",
    choice: "AGAINST",
    weight: "100000000000000000000000",
    voter: { id: "0xb" },
    block: "180",
    blockTime: "1960",
    txnHash: "0xvote-b",
    logIndex: "2",
  },
];

const graphMeta = {
  deployment: "QmDeployment",
  block: { number: 123456, hash: "0xindexed", timestamp: 4000 },
  hasIndexingErrors: false,
};

test("parses explicit arguments and preserves the proposal-393 default", () => {
  const defaults = parseCliArgs([], "/repo");
  assert.equal(defaults.proposalId, "393");
  assert.equal(
    defaults.outputPath,
    "/repo/landing-page/app/data/compound-393-health-report.json",
  );

  const explicit = parseCliArgs(
    ["--proposal", "42", "--output", "reports/42.json"],
    "/repo",
  );
  assert.deepEqual(explicit, {
    proposalId: "42",
    outputPath: "/repo/reports/42.json",
    help: false,
  });
  assert.throws(() => parseCliArgs(["--network", "mainnet"]), /Unknown option/);
  assert.throws(() => parseCliArgs(["--proposal", "abc"]), /decimal digits/);
});

test("paginates complete ballots with an immutable id cursor", async () => {
  const cursors = [];
  const queryGraph = async (_query, variables) => {
    cursors.push(variables.cursor);
    if (variables.cursor === "") return { votes: [votes[0], votes[1]] };
    return {
      votes: [
        {
          ...votes[1],
          id: "c-393",
          voter: { id: "0xc" },
          txnHash: "0xvote-c",
        },
      ],
    };
  };

  const result = await fetchAllVotes("393", queryGraph, 2);
  assert.deepEqual(cursors, ["", "b-393"]);
  assert.deepEqual(result.map(({ id }) => id), ["a-393", "b-393", "c-393"]);
});

test("fails loudly when the indexed vote count and fetched ballots differ", () => {
  assert.throws(
    () => assertSupportedProposal(proposal, votes.slice(0, 1)),
    /refusing truncated output/,
  );
});

test("emits canonical findings and complete Graph provenance", async () => {
  const report = await buildCompoundReport({
    proposal,
    votes,
    graphMeta,
    retrievedAt: "2026-07-26T04:00:00.000Z",
  });

  assert.equal(report.schemaVersion, "0.1.0");
  assert.equal(report.subject.proposalId, "393");
  assert.equal(report.source.voteCount, 2);
  assert.equal(report.source.graphProvenance.subgraphId, COMPOUND_SUBGRAPH_ID);
  assert.equal(report.source.graphProvenance.indexedBlockNumber, 123456);
  assert.equal(report.source.graphProvenance.governorAddress, COMPOUND_GOVERNOR);
  assert.equal(report.source.retrievedAt, "2026-07-26T04:00:00.000Z");
  assert.equal(report.deterministicFindings.signals.quorumProgress, 1);
  assert.equal(
    await hashGovernanceHealthReport(report),
    report.verification.reportHash,
  );

  // Check every root-level property required by the published JSON Schema.
  const schema = JSON.parse(
    await readFile(
      new URL("../schemas/governance-health-report.schema.json", import.meta.url),
      "utf8",
    ),
  );
  for (const required of schema.required) {
    assert.ok(required in report, `missing schema property ${required}`);
  }
});

test("rewrites network failures without leaking the API key", async () => {
  const secret = "graph-secret-that-must-never-escape";
  const query = createGraphClient(secret, async () => {
    throw new Error(`failed https://gateway.thegraph.com/api/${secret}`);
  });

  await assert.rejects(
    () => query("{ _meta { deployment } }"),
    (error) => {
      assert.doesNotMatch(error.message, new RegExp(secret));
      assert.doesNotMatch(error.message, /gateway\.thegraph\.com\/api\//);
      return true;
    },
  );
});
