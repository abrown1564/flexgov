---
name: compound-governance-report
description: Generate a canonical FlexGov Governance Health Report for a supported Compound Governor proposal using complete live ballot and lifecycle data from The Graph.
---

# Compound Governance Report

Use this tool when an agent needs a reproducible, machine-readable governance
analysis of a Compound Governor Bravo proposal. FlexGov is the reference
consumer, but the generated JSON is independent of the FlexGov UI.

## Qualifying Graph product

The tool uses The Graph's decentralized subgraph Query API. It has been
qualified against:

- Subgraph ID: `7nuSuPhUgKSg5uKRh8g5jyjZWE8DnvQw1mQtvDWpxrnh`
- Network: Ethereum mainnet
- Governor: Compound Governor Bravo
- Governor address: `0xc0da02939e1441f497fd74f78ce7decb17b66529`
- Reference case: Compound proposal `393`

Do not substitute an exchange, token, or protocol-activity subgraph. This
adapter relies on the validated Compound governance schema.

## Prerequisites and secret handling

1. Use Node.js 22 or later.
2. From `engine/`, run `npm install` and `npm run build`.
3. Set `THE_GRAPH_API_KEY` in the server-side environment or an ignored local
   env file.
4. Never put the key in a prompt, CLI argument, output path, generated artifact,
   browser environment variable, log, or commit.

The CLI builds the authenticated gateway URL only in memory. Errors and stdout
omit both the API key and the secret-bearing gateway URL.

## Invocation

From the repository root:

```bash
export THE_GRAPH_API_KEY="your-local-key"
node scripts/generate-compound-graph-report.mjs \
  --proposal 393 \
  --output reports/compound-393.json
```

With an existing ignored `engine/.env`:

```bash
node --env-file=engine/.env scripts/generate-compound-graph-report.mjs \
  --proposal 393 \
  --output reports/compound-393.json
```

The original pinned command is preserved:

```bash
cd engine
npm run generate:compound
```

Inputs:

- `--proposal`, `-p`: decimal Compound Governor proposal ID.
- `--output`, `-o`: destination JSON path; parent directories are created.
- `--help`, `-h`: print the supported interface.

Defaults are proposal `393` and
`landing-page/app/data/compound-393-health-report.json`. Arbitrary subgraph and
network overrides are not accepted because no other Graph schema has been
qualified.

## Output

The command writes one canonical Governance Health Report conforming to
`schemas/governance-health-report.schema.json`. It includes:

- proposal identity, state, choices, and normalized voting window;
- complete normalized ballots and deterministic FlexGov findings;
- authoritative quorum, Governor/token/timelock identity, actions, and
  queue/execution lifecycle;
- subgraph ID, network, Governor address, deployment, retrieval time, indexed
  block, and indexing-error status;
- source-data, configuration, and canonical report hashes;
- explicit data availability and limitations.

The JSON can be archived, diffed, ingested into another application, or served
to a UI without using the FlexGov frontend. Treat `source` and
`governanceContext` as indexed evidence; treat `deterministicFindings` as the
engine's interpretation.

## Agent examples

Example prompt:

> Generate a canonical FlexGov report for Compound proposal 393 through The
> Graph, save it to `reports/compound-393.json`, and report the vote count,
> indexed block, and hashes without printing the API key.

Example shell call:

```bash
node --env-file=engine/.env scripts/generate-compound-graph-report.mjs \
  --proposal 393 \
  --output reports/compound-393.json
```

Example downstream check:

```js
import { readFile } from "node:fs/promises";

const report = JSON.parse(
  await readFile("reports/compound-393.json", "utf8"),
);
if (report.schemaVersion !== "0.1.0") {
  throw new Error("Unsupported Governance Health Report schema");
}
console.log(report.source.graphProvenance);
console.log(report.verification.reportHash);
```

## Runtime and deterministic boundary

Retrieval is live and server-side: The Graph supplies the current indexed
proposal, ballots, lifecycle, and provenance. Normalization, FlexGov analysis,
canonical serialization, and hashing are deterministic for the same retrieved
source payload, configuration, and report timestamp. There is no runtime AI,
LLM judgment, or hidden model score in the report.

`generatedAt` and the current Graph indexed block can change between runs.
Consequently, a newly generated report hash may differ even when the governance
outcome is unchanged. The source and configuration hashes make those inputs
inspectable.

## Limitations and failure behaviour

The CLI fails with a non-zero exit rather than producing a partial report when:

- the proposal is missing or belongs to a different Governor;
- the fetched ballot count differs from the proposal's indexed vote total;
- cursor pagination stalls or returns an unsupported payload;
- action arrays, vote choices, numeric fields, or stable voter IDs are
  incompatible;
- required lifecycle anchors for safe voting-window normalization are absent;
- The Graph returns a network, HTTP, GraphQL, or indexing-shape error.

Voting-window timestamps are interpolated from authoritative indexed lifecycle
anchors because this deployment does not expose historical block timestamps.
Wallet age, funding links, token-acquisition history, and forum activity are not
connected. The tool supports only the named Compound source; support for another
Governor requires a separately validated adapter and tests.
