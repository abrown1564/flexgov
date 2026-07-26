# Agents Working

## HULK — Report verification foundation

Added deterministic canonical JSON, SHA-256 source/configuration/report hashes,
and a frontend verification disclosure. This creates reproducible report
identities that can later be stored content-addressably and attested on-chain
without presenting an unsubmitted storage or chain reference as complete.

Added a reusable Snapshot report generator and pinned the current closed ENS
proposal. This tests the schema on a second DAO without tying reproducibility to
Snapshot's moving “latest proposal” pointer.

Generated and wired pinned reports for every DAO currently shown in the UI.
Keeping “fetch latest” beside “load verified closed report” preserves live
exploration while making the reproducible examples reliably reviewable.

## PRIZE — Partner-prize mechanism and build audit

Reviewed and deduplicated all Markdown documentation across `flexgov-app` and
`flexgov-public`, then consolidated every mechanism, feature, integration, demo
artifact, and build proposed for The Graph, 0G, World, or Uniswap prizes.

The resulting baseline separates the shared FlexGov foundation from
partner-specific work:

- **The Graph:** live Governor source validation and adapter, late-acquisition
  watcher, governance MCP/SKILL, standardized schema, Substreams, x402, and the
  BonkDAO/Realms stretch;
- **0G:** Compute/Private Computer interpretation, inference attestation,
  Storage persistence, Chain provenance, verification UI, and the alternative
  reusable report SDK framing;
- **World:** AgentKit authorization and human-in-the-loop controls, Selfie Check
  challenge eligibility and feedback, and conditional privacy-minimized
  Identity Check use;
- **Uniswap:** multi-size routing/quote acquisition-cost curves, market-impact
  and deterrence coverage, secure API integration, feedback, and audit-ready
  README evidence.

Surfaced unresolved contradictions rather than silently choosing between them:
the engine's QV/1W1V recommendations versus the whitepaper's splitting-neutral
invariant; implemented versus still-experimental Gini normalization; Compound
Governor versus BonkDAO Substreams as the primary Graph path; Graph product
work versus reusable tooling; old private-voting 0G scope versus the newer
report-provenance scope; World uniqueness and Selfie Sybil-score assumptions;
quote-only Uniswap qualification; late voting versus late acquisition;
Snapshot quorum/turnout gaps; batch versus stream cluster detection; canonical
report status; advisory versus enforcement wording; deferred ML; and the older
three-partner plan versus the current four-partner tracking scope.

Recommended consolidated product direction: canonical deterministic governance
report → live Governor data through The Graph → AI explanation and reusable
governance tooling → Uniswap acquisition-cost curve → 0G-attested
interpretation/provenance → World-backed challenge and review authorization,
with BonkDAO replay retained as the narrative demo rather than live
qualification evidence.

## TODO — Deadline task tracking and partner checks

Tracked and reprioritised the owner's hackathon to-do list across six scheduled
check-ins, repeatedly checking `PARTNER_TRACK_REQUIREMENTS.md` against the
current repository state.

Clarified that the missing Ideal Governance Health Report thread was primarily
**late acquisition or delegation of voting power**, which is distinct from the
implemented late-voting signal. Connected the report's remaining data needs to
the proposed source architecture:

- use a focused EVM Governor Subgraph for proposal state, votes, quorum,
  execution timing, targets and any available delegation checkpoints;
- reserve Substreams for broader token-movement streams or the higher-risk
  Solana/Realms reconstruction;
- retain BonkDAO as the narrative replay unless real Graph infrastructure
  supplies its data;
- expose unavailable inputs honestly rather than fabricating quorum, turnout
  or acquisition findings from Snapshot data.

Maintained the main deadline board around:

- securing at least one genuinely qualifying partner integration;
- writing the ENS/Nick.eth and BonkDAO considerations;
- verifying the existing problem-framing flowchart against the latest engine;
- reviewing the owner's Word document and Problem Framing notes;
- reconciling public claims with late engine changes;
- protecting time for commits, deployment, video, screenshots and submission.

Initially identified the live Graph Governor path as the strongest qualifying
partner route, with a strict source-validation cutoff. Later checks found that
the active implementation was in `flexgov-public`, not `flexgov-app`, and
verified substantial progress on the shared foundation:

- canonical `GovernanceHealthReport` types and JSON Schema;
- deterministic canonical JSON plus source, configuration and report hashes;
- frontend verification disclosure;
- explicit data-availability reporting;
- full-approval ballot interpretation;
- updated Optimism and ENS report fixtures;
- a repeatable Snapshot report-generation script;
- expanded engine coverage, with all 33 tests passing. The local command only
  exited unsuccessfully after the tests because the sandbox could not write
  Vitest's cache file outside its writable workspace.

Repeatedly flagged that Snapshot is useful live product data but is not a Graph
product and therefore does not qualify for The Graph prizes. The minimum honest
Graph vertical slice remains:

```text
live Governor Subgraph
  → normalised proposal and votes
  → deterministic engine
  → canonical Governance Health Report
  → visible Graph source and provenance
```

Also surfaced the final deadline risks:

- the newest report, schema, fixtures, generator and UI work remained
  uncommitted at the last check;
- no completed Graph, 0G, World or Uniswap integration was evidenced;
- partner references in research or UI copy do not establish qualification;
- the public README still needs exact generation/setup commands, hashes,
  limitations, integration evidence and the deployed URL;
- a strong base submission should be preserved rather than claiming an
  incomplete partner integration.

Final recommended order was: commit and push the current
`flexgov-public` work, build and verify the deployment, preserve reproducibility
evidence, complete the base submission and demo materials, then attempt only a
partner integration that can still be demonstrated end to end.
