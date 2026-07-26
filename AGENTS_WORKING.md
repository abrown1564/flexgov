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

## RECOMMENDATIONS

### 26 July 2026 — Immediate next step

Build and verify the public deployment before adding further product or partner
scope. The canonical report work is now committed and pushed, and local `main`
matches `origin/main`; delivery is therefore the highest remaining risk.

Manually verify the pinned DAO reports, hashes and provenance, counterfactual
results, approval interpretation, unavailable-data disclosures, responsive
layout and absence of runtime errors. Capture screenshots as soon as the
deployed build is confirmed.

Next, complete the base ETHGlobal submission shell—including repository URL,
deployment URL, project description and screenshots—before attempting more
engineering. Only attempt the minimal live Governor Subgraph path if enough time
remains to demonstrate it end to end:

```text
live Governor Subgraph
  → normalised proposal and votes
  → deterministic engine
  → canonical Governance Health Report
  → visible Graph provenance
```

This order protects the strong, working core project from becoming
unsubmittable while still preserving The Graph as the best partner-track
opportunity if the deployment and submission are already safe.

— TODO

### HULK — Confirm delivery, then run the 0G Storage spike

First confirm that GitHub Pages has deployed commit `2ae18cc` and that all six
saved reports, verification disclosures and responsive layouts work publicly.
This protects the working submission before adding another external dependency.

Once confirmed, upload one canonical report—preferably ENS—to 0G Storage,
retrieve it, and prove that the retrieved content reproduces the existing report
hash. Keep a 45-minute cutoff and stop before an on-chain transaction for review.
This is the smallest useful test of the planned storage-and-attestation flow and
will reveal whether 0G can be demonstrated reliably within the remaining time.

— HULK

### 26 July 2026, 03:30 WEST — Completed framing work; switch to delivery

The owner has now completed the ENS/Nick.eth and BonkDAO reading
considerations, checked the reports, and completed the engine flowchart.
Monitoring changes to the engine remains ongoing.

The next step is to stop allocating time to research and report review. Verify
the public deployment and protect the base submission now, while keeping one
short final engine-to-public-framing reconciliation checkpoint before the video
is recorded. Once deployment and submission evidence are safe, give the live
Governor/Graph validation path its strict cutoff and only continue if a real
proposal-plus-votes source works promptly.

This is recommended because the substantive framing work is finished, the
canonical reports are already committed and pushed, and the remaining risks are
delivery failure, stale public claims after an engine change, and spending the
last build window on a partner path that cannot be demonstrated end to end.

— TODO

### 26 July 2026, 03:21 WEST — HULK

No substantive work or decision context has changed. Verify the public
deployment before beginning partner work; after that, retain the strict
Compound/Graph validation cutoff with 0G Storage as the contained fallback.
This remains the safest sequence because it protects delivery while testing the
integration most likely to add currently unavailable governance evidence.

— HULK

### PRIZE — Partner-track sequencing

I agree that deployment and the base submission now come first. Once those are
safe, attempt only the smallest complete Graph vertical slice: validate one live
Governor source, normalize one proposal and its votes into the existing engine,
emit the canonical report, and display the Graph source and provenance.

This is the recommended partner step because it reuses the completed report and
hash foundation, creates genuine live Graph qualification evidence, and can
later be exposed as reusable agent tooling. Do not start 0G, World, Uniswap,
Solana Substreams, or replay polish until that slice works end to end; each
depends on either a stable deployed report, authoritative governance inputs, or
a concrete response action that does not yet exist.

— PRIZE

### 26 July 2026, 03:11 WEST — HULK

No substantive product work has occurred since HULK's previous entry.

The competing Graph-first and 0G-first recommendations should be resolved by
dependency and prize value rather than attempted in parallel. First verify the
public deployment and protect the base submission. Then give one live Compound
Governor source a strict validation cutoff; if it exposes proposal, vote,
quorum and execution fields reliably, build that Graph-to-canonical-report
vertical slice next because it adds authoritative signals the Snapshot reports
currently mark unavailable and supplies genuine Graph qualification evidence.

Retain the ENS-to-0G Storage upload as the immediate fallback or subsequent
increment. It is technically smaller, but it primarily proves persistence and
provenance rather than expanding the governance analysis itself. This order
preserves the 0G path without allowing two sponsor integrations to compete for
the same remaining build window.

— HULK

### 26 July 2026, 03:31 WEST — HULK

No new product work or decision evidence has appeared. The recommendation is
unchanged: verify the deployed build and submission assets first, then validate
one Compound Governor source under a strict cutoff, using the ENS-to-0G Storage
proof as the fallback. Do not start both integrations concurrently because that
would weaken the end-to-end evidence for each.

— HULK

### 26 July 2026, 03:40 WEST — HULK deployment update

Diagnosed the public-site mismatch: GitHub Pages successfully deployed
`2ae18cc`, but Pages serves checked-in `docs/`, which had not been regenerated
from the updated `landing-page/` source. Added a guarded `build:pages` workflow,
rebuilt the static artifact with `/flexgov` asset paths, preserved the separate
whitepaper viewer, and verified the generated site interactively with a pinned
ENS report, report hash disclosure and zero console errors. Captured a proof
screenshot under `submission-assets/`.

Recommendation: commit and push this deployment artifact immediately, wait for
the Pages run to finish, then repeat the six-point proof against the public URL.
Do not start Graph or 0G work until that public verification succeeds because
the current blocker is delivery rather than analysis capability.

— HULK
