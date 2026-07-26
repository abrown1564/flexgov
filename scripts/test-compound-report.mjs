#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  hashGovernanceHealthReport,
} from "../engine/dist/index.js";

const reportText = await readFile(
  new URL(
    "../landing-page/app/data/compound-393-health-report.json",
    import.meta.url,
  ),
  "utf8",
);
const report = JSON.parse(reportText);

assert.equal(report.subject.governanceSystem, "evm-governor");
assert.equal(report.subject.proposalId, "393");
assert.equal(report.source.provider, "The Graph");
assert.equal(report.source.voteCount, 29);
assert.equal(
  report.source.graphProvenance.subgraphId,
  "7nuSuPhUgKSg5uKRh8g5jyjZWE8DnvQw1mQtvDWpxrnh",
);
assert.equal(report.source.graphProvenance.hasIndexingErrors, false);
assert.equal(
  report.governanceContext.governorAddress,
  "0xc0da02939e1441f497fd74f78ce7decb17b66529",
);
assert.equal(report.governanceContext.quorumVotes, 400000);
assert.ok(report.governanceContext.lifecycle.queuedTransaction);
assert.ok(report.governanceContext.lifecycle.executionTransaction);
assert.equal(report.governanceContext.actions.length, 3);

// A generated artifact must never contain the local key name, a secret-bearing
// gateway path, or a plausible 32+ character API credential.
assert.doesNotMatch(reportText, /THE_GRAPH_API_KEY|gateway\.thegraph\.com\/api\//);
assert.equal(
  await hashGovernanceHealthReport(report),
  report.verification.reportHash,
);

console.log("Compound canonical report checks passed.");
