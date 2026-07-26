# FlexGov

**Governance observability for DAOs: evidence before intervention.**

FlexGov turns governance data into deterministic, explainable Governance Health
Reports. The current reference integration retrieves a complete Compound
Governor proposal and its individual ballots through The Graph, normalizes them
for the FlexGov engine, and emits a canonical machine-readable JSON report with
source, configuration, and report hashes.

- [Public demo](https://abrown1564.github.io/flexgov/)
- [Agent tool guide](./skills/compound-governance-report/SKILL.md)
- [Canonical report schema](./schemas/governance-health-report.schema.json)
- [Whitepaper v0.1](./WHITEPAPER_v0.1.md)

## The Graph integration

The supported flow is:

```text
Compound Governor Bravo on Ethereum
  → The Graph decentralized Query API
  → complete cursor-paginated proposal ballots + lifecycle metadata
  → source normalization and completeness checks
  → deterministic FlexGov engine
  → canonical Governance Health Report JSON + verification hashes
  → optional FlexGov UI consumption
```

| Field | Validated source |
| --- | --- |
| The Graph product | Decentralized subgraph Query API |
| Subgraph ID | `7nuSuPhUgKSg5uKRh8g5jyjZWE8DnvQw1mQtvDWpxrnh` |
| Network | Ethereum mainnet |
| Governance system | Compound Governor Bravo |
| Governor address | `0xc0da02939e1441f497fd74f78ce7decb17b66529` |
| Reference proposal | Compound proposal `393` |

The server-side adapter retrieves proposal facts, quorum, contract actions,
queue/execution lifecycle, Graph deployment/indexed-block metadata, and every
individual vote. Ballots are paginated using an immutable ID cursor, then
checked against the subgraph's proposal vote total. A mismatch is an error, not
a partial report.

## Reproduce the report

Prerequisites: Node.js 22 or later and a The Graph API key. Keep the key in the
environment; never pass it as a command-line argument.

```bash
cd engine
npm install
npm run build
cd ..
export THE_GRAPH_API_KEY="your-local-key"
node scripts/generate-compound-graph-report.mjs \
  --proposal 393 \
  --output reports/compound-393.json
```

If the key is already stored in `engine/.env`, the repository's existing
proposal-393 command remains available:

```bash
cd engine
npm run generate:compound
```

To see the supported arguments:

```bash
node scripts/generate-compound-graph-report.mjs --help
```

The generic command accepts a Compound proposal ID and output path. Arbitrary
subgraph and network overrides are deliberately rejected: the adapter currently
qualifies one known schema and fails rather than guessing at incompatible data.

## Agent and downstream use

The CLI is the reusable agent-facing boundary. A coding agent can invoke it,
inspect the non-secret summary printed to stdout, and pass the JSON file to any
consumer. The output does not depend on the FlexGov website. Consumers can
validate `schemaVersion`, inspect `source.graphProvenance`, and recompute or
record the hashes in `verification`.

The public UI currently displays a **precomputed** canonical report generated
from live The Graph data for Compound proposal 393. The browser does not receive
the Graph API key and does not query the authenticated gateway.

## Scope and claims

This repository implements deterministic governance analysis; it does not use
runtime AI. It does not currently provide an MCP server, Substreams, continuous
monitoring, late-acquisition watching, or on-chain attestation. The report is
decision support: findings and unavailable data are exposed separately so a
community can decide how to respond.

## Repository map

- `scripts/generate-compound-graph-report.mjs` — reusable Graph-backed CLI
- `skills/compound-governance-report/SKILL.md` — agent-facing operating guide
- `engine/` — deterministic TypeScript analysis and canonical report builder
- `schemas/` — public Governance Health Report JSON Schema
- `landing-page/` — reference consumer and public demo
- `scripts/compound-graph-tool.test.mjs` — CLI, completeness, provenance, hash,
  and secret-safety qualification tests

Run the relevant checks with:

```bash
cd engine
npm test
npm run test:compound
cd ../landing-page
npm test
```
