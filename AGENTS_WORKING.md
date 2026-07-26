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

## PRIZE — Deployment artifact refreshed

The public-delivery blocker identified by HULK has materially changed: commit
`690fa0e` refreshed the checked-in GitHub Pages artifact after confirming that
Pages serves `docs/` rather than the newer `landing-page/` source directly. The
generated build now uses the `/flexgov` asset path, preserves the whitepaper
viewer, and has local interactive evidence for the pinned ENS report, report
hash disclosure, and a clean console. A proof screenshot was also added under
`submission-assets/`.

This removes the stale-artifact problem from the codebase, but public delivery
is not complete until the new Pages run and public URL are verified.

— PRIZE

## PRIZE — Public delivery verified and submission copy prepared

The delivery gate is now cleared. GitHub Pages completed successfully for
commit `690fa0e`; the real public site renders the governance panel and report
verification control, loads the pinned ENS 67-ballot report with its canonical
hash disclosure, reports no browser-console errors, and serves both the landing
page and whitepaper viewer successfully. Public proof imagery has been captured.

A detailed, paste-ready ETHGlobal description has also been prepared covering
the implemented governance observability, live Snapshot analysis,
counterfactuals, explainable signals, canonical report schema, reproducibility
hashes, and community-controlled advisory framing.

— PRIZE

## PRIZE — Submission technology and AI claims clarified

The submission's technology and AI-use fields now have evidence-aligned
wording. The current implemented stack is TypeScript/JavaScript, HTML/CSS,
React, Next.js, Vinext/Vite, Node.js, Snapshot Hub GraphQL, JSON Schema, Web
Crypto, and GitHub Pages, with no database. AI assistance can be disclosed as
ChatGPT/Codex, Claude Code, and DeepSeek while making clear that governance
signals, counterfactuals, hashes, and report results come from deterministic,
inspectable code rather than an AI-generated risk verdict.

The Graph must not appear as implemented submission technology unless a real
Graph data-to-report path is completed and demonstrated.

— PRIZE

## PRIZE — Compound Graph gate passed and adapter foundation started

The proposed Graph path is no longer speculative. Read-only validation confirmed
that Compound Governor Bravo proposal 393 is available from live Ethereum
subgraph `7nuSuPhUgKSg5uKRh8g5jyjZWE8DnvQw1mQtvDWpxrnh`, with individual ballots,
weights, transaction provenance, lifecycle blocks, fixed quorum, queued and
executed transactions/times, action targets/signatures, contract addresses, and
indexed deployment provenance. The source reports no indexing errors.

Uncommitted implementation work has started extending the canonical report for
Graph provenance and on-chain Governor context, and adding support for an
authoritative direct quorum target. This is useful foundation work, but it is
not yet a qualifying Graph integration: the adapter, pagination, generated
report, tests, UI evidence, deployment, and demonstration still need to be
completed.

— PRIZE

## PRIZE — Graph integration and prize qualification separated

MEDIATOR confirmed the Compound source is the strongest evidence-backed path
toward qualification, while clarifying that source validation—or even a shipped
Graph-derived report—does not by itself satisfy a Graph AI prize.

The narrow report must derive quorum progress/margin without inventing eligible
turnout; leave title, treasury value, forum activity, wallet relationships, and
late acquisition unavailable; name the authoritative source used for block
timestamps; paginate beyond 1,000 votes or fail loudly; record retrieval time,
Subgraph/network/Governor/proposal/indexed-block provenance; and keep the API key
out of reports, browser code, and logs. A generated artifact must be described
as a **precomputed report sourced from live Graph data**, not a continuously
live Graph dashboard.

After that report ships, the prize gaps remain distinct:

- AI Use Case still needs a runtime AI/agent component reasoning over the
  Graph-derived report;
- AI Tooling still needs reusable agent-facing tooling and documentation;
- Composable/Standardized still needs genuine product composition or meaningful
  standards work.

— PRIZE

## PRIZE — Compound Graph report vertical slice present

The working tree now contains a real Graph-derived canonical report for Compound
Governor proposal 393. It includes 29 indexed ballots, the authoritative
400,000 COMP quorum, Governor and timelock addresses, proposal actions,
queue/execution lifecycle, Subgraph and indexed-block provenance, and a
canonical report hash. The report schema and UI have been extended to keep these
on-chain facts separate from engine interpretations.

The dedicated Compound report validation script passes. The integration remains
uncommitted and the generated Pages assets have changed, so public evidence is
not yet secure. Full engine/UI testing, secret scanning, commit/push, Pages
completion, and public verification remain required before The Graph can be
listed as implemented.

— PRIZE

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

### 26 July 2026, 03:59 WEST — HULK submission implementation summary

Prepared the paste-ready ETHGlobal “How it’s made” response. It documents the
TypeScript analysis engine, React/Next.js interface, Snapshot Hub GraphQL
adapter, ballot normalisation, counterfactual models, explainable signals,
canonical JSON and verification hashes, pinned multi-DAO reports, and the
guarded Vinext/Vite GitHub Pages export. It carefully describes Graph and other
governance adapters as extensibility paths rather than completed integrations.
No repository product files or deployment state changed.

Recommendation: save both completed narrative fields and the verified project
links/screenshots in the ETHGlobal draft before beginning partner work. This
refines rather than changes the prior recommendation: the deployment gate is
complete, but the submission itself remains the immediate delivery dependency;
after it is saved, apply the strict Compound Governor source-validation cutoff.

— HULK

### 26 July 2026, 04:25 WEST — HULK Compound/The Graph gate passed

Completed the read-only Compound Governor source-validation gate using the
existing local `THE_GRAPH_API_KEY`; the key was neither displayed nor committed.
No product files were built or changed.

Validated The Graph subgraph
`7nuSuPhUgKSg5uKRh8g5jyjZWE8DnvQw1mQtvDWpxrnh` on Ethereum mainnet against
Compound Governor Bravo
`0xc0da02939e1441f497fd74f78ce7decb17b66529`. Real executed proposal 393
returned individual votes and weights, voter and transaction provenance,
proposal creation/start/end blocks, fixed quorum, queue and execution
transactions/times, target contracts, call signatures, COMP and timelock
addresses, plus subgraph deployment and indexed-block provenance. The
deployment reported no indexing errors.

The source passes the agreed gate for conversion into the canonical report.
Fields requiring derivation or another source are: a parsed title, start/end
timestamps from block data, turnout and quorum margin calculations, historical
percentiles, ABI-aware permission interpretation, treasury-value context,
forum activity, wallet age/funding links and late token-acquisition history.
Full vote retrieval must use pagination above 1,000 records.

Recommendation: build one narrow Compound Graph adapter next—proposal 393 →
normalised ballots and lifecycle metadata → existing deterministic engine →
canonical report—with visible Graph subgraph/deployment/block provenance.
Stop after this end-to-end report is reproducible and reviewed; do not broaden
to another Graph DAO or 0G before that evidence is secure.

— HULK

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

### PRIZE — Convert the Graph working tree into public evidence

Stop adding fields. Run the full engine suite, dedicated Compound report check,
landing-page build/test, schema validation, and secret scan; then review the
diff, commit, push, wait for Pages, and verify the public Compound report.
Capture evidence showing “The Graph · Ethereum mainnet,” quorum, lifecycle,
Subgraph ID, indexed block, and report hash. This is now higher value than any
new feature because the complete path exists but remains vulnerable as an
uncommitted working tree.

After public verification, update the submission to describe The Graph as an
implemented data integration and precomputed report sourced from live Graph
data. Do not claim an AI prize is satisfied unless a runtime AI/agent component
is also completed and demonstrated. Reassess that one increment only after the
report and base submission are safe; do not start 0G or broaden Graph scope now.

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

### 26 July 2026, 03:40 WEST — Public deployment is now the hard gate

Commit `690fa0e` has been pushed to refresh the GitHub Pages report UI after the
deployment mismatch was traced to stale checked-in `docs/` output. The generated
preview has already been checked with a pinned ENS report, visible report hash
and no console errors, and a proof screenshot now exists in
`submission-assets/`.

Wait for the GitHub Pages run for `690fa0e`, then verify the public URL—not only
the local preview—against the six saved reports, verification disclosures,
asset loading, responsive layout and browser console. Capture the public URL
and final screenshots directly into the submission materials. If that passes,
immediately fill the base ETHGlobal submission shell before starting Graph or
0G work.

This is now the best next step because the deployment mechanism has changed and
local success does not yet prove that judges can access the refreshed artifact.
Partner engineering should not consume time until the public build and base
submission are demonstrably safe.

— TODO

### 26 July 2026, 03:45 WEST — HULK public verification complete

GitHub Pages completed successfully for deployment commit `690fa0e`. Verified
the real public URL: the governance panel and verified-report control render,
the pinned ENS report loads, its 67-ballot analysis and canonical hash disclosure
appear, the browser console reports no errors, and both the landing page and
whitepaper viewer return HTTP 200. Captured a public proof screenshot.

Recommendation: save the repository URL, live URL, description and current
screenshots into the ETHGlobal submission draft now. Once that draft is safe,
use a strict cutoff to validate one Compound Governor/Graph source before
choosing between the Graph vertical slice and the smaller 0G Storage proof.

— HULK

### 26 July 2026, 03:52 WEST — HULK submission update

Prepared a detailed, paste-ready ETHGlobal project description covering
FlexGov's governance-observability purpose, live Snapshot analysis,
counterfactual voting comparisons, explainable signals, canonical report
schema, reproducibility hashes and modular community-controlled design. No
product source or deployment state changed.

Recommendation: paste and save this description, the repository and live URL,
and the verified public screenshot in the ETHGlobal submission draft now. This
supersedes the earlier deployment gate because public verification has passed;
once the draft is saved, validate one Compound Governor/Graph source under the
existing strict cutoff before starting either sponsor integration.

— HULK

### 26 July 2026, 03:52 WEST — Save the submission draft before partner work

The refreshed public deployment has now passed verification at the real URL:
the pinned ENS report and canonical hash disclosure render, the browser console
is clean, and both the landing page and whitepaper viewer return successfully.
The detailed project description is also ready for the submission form.

Paste and save the description now together with the GitHub repository, live
URL and verified public screenshot. Confirm that the draft persists before
leaving the submission page. Then validate one live Compound Governor source
under the existing strict cutoff; continue with The Graph only if it promptly
returns a complete proposal and votes suitable for the canonical report.

This is recommended because delivery is now technically verified but still
depends on the submission form being saved. Securing that draft removes the
largest remaining administrative failure mode before the final partner build
window is used.

— TODO

### 26 July 2026, 04:09 WEST — HULK submission-form guidance

Completed guidance for the submission's technology and AI-use fields. The
accurate current stack is TypeScript/JavaScript, HTML/CSS, React, Next.js,
Vinext/Vite, Node.js, Snapshot Hub GraphQL, JSON Schema, Web Crypto and GitHub
Pages, with no database. Prepared transparent AI-use wording covering
ChatGPT/Codex, Claude Code and DeepSeek while making clear that report results
come from deterministic, inspectable calculations rather than AI-generated
risk judgments. Flagged that The Graph must be removed from the submission
unless a real integration is completed and demonstrated.

Recommendation: finish and save the current submission form without claiming
unfinished partner technology. After confirming that the draft persisted,
validate the Compound Governor/Graph source under the strict cutoff; only add
The Graph back to the form if that complete data-to-report path becomes part of
the submitted build. This resolves the tension between prize ambition and
submission accuracy in favour of evidence judges can reproduce.

— HULK

### 26 July 2026, 04:16 WEST — Finish the form with evidence-backed claims

The owner is actively completing the submission fields: the detailed project
description, technology selections and transparent AI-use explanation are now
prepared. The current build uses Snapshot Hub GraphQL rather than The Graph and
produces deterministic engine findings rather than runtime AI judgments.

Finish and save every currently available submission field now. Do not select
The Graph unless a real Graph-backed proposal-to-report path is added and
demonstrated before the final submission. List the implemented stack—TypeScript,
JavaScript, React/Next.js, Vinext/Vite, Node.js, Snapshot Hub GraphQL, JSON
Schema, Web Crypto, Vitest and GitHub Pages—and keep the database selection as
none.

This is recommended because the submission is now being assembled and
overclaiming an unfinished sponsor technology creates more judging risk than it
creates prize value. Once the saved draft is confirmed, the remaining partner
spike can proceed without endangering the accurate base entry.

— TODO

### 26 July 2026, 04:24 WEST — HULK

No substantive product work or new decision evidence has appeared since the
previous HULK entry.

Recommendation: the immediate gate remains confirmation that the ETHGlobal
draft has been saved with evidence-backed stack claims. Until that confirmation
exists, do not spend the remaining build window on Graph or 0G and do not list
either as implemented; once saved, the strict Compound Governor source check is
the next bounded technical step.

— HULK

### 26 July 2026, 04:37 WEST — Complete and ship the Graph vertical slice

A real Compound Governor integration through The Graph is now present in the
working tree. The generated proposal 393 report contains 29 indexed ballots,
authoritative 400,000 COMP quorum, Governor and timelock addresses, proposal
actions, queue/execution lifecycle, subgraph and indexed-block provenance, and
a verified canonical report hash. The UI and report schema have also been
extended to display the on-chain evidence separately from engine
interpretations.

Stop adding fields and finish this vertical slice: run the engine tests, the
dedicated Compound report check, the landing-page build/test, and a secret scan;
then commit, push, wait for Pages, and verify the public Compound report. Capture
screenshots showing “The Graph · Ethereum mainnet,” quorum, execution evidence,
subgraph ID and report hash. Only after public verification should the
submission be updated to select The Graph and describe the exact subgraph-backed
flow.

This is recommended because the previously missing partner qualification path
now exists end to end in code and data. The highest-value action is converting
that working tree into reproducible public evidence; additional features would
increase regression and deadline risk without strengthening qualification as
much as tests, deployment and documentation.

— TODO
