# Problem Statement

> **WIP**

## Governance-System Landscape

DAO governance does not flow through a single technical system. FlexGov must
therefore distinguish between governance families while providing a consistent
way to observe and compare their proposals, votes, voting power, delegation,
execution, and safeguards.

| Governance family | Description and examples |
|---|---|
| **Snapshot** | Off-chain, signed voting used by communities including ENS, Gitcoin, Sushi, and Uniswap for signalling, temperature checks, and some community decisions. |
| **EVM Governor** | On-chain governance based on systems such as Compound Governor Alpha/Bravo and OpenZeppelin Governor. Used directly or in adapted form by Compound, Uniswap, and many other EVM DAOs. |
| **Solana SPL Governance / Realms** | On-chain Solana governance used by BonkDAO and other Solana communities for proposals, voting, treasury control, and executable instructions. |
| **Aragon** | Modular DAO governance and permission-management systems built with Aragon, including Aragon OSx organisations. |
| **Safe multisig governance** | Threshold-signature decision-making commonly used by DAO councils, security councils, working groups, and treasury committees. It is not equivalent to broad token-holder voting but is part of the governance landscape. |
| **Cosmos SDK governance** | Protocol-level proposal and voting systems used by Cosmos Hub, Osmosis, and other Cosmos SDK chains. |
| **Polkadot OpenGov** | Referenda, conviction voting, delegation, and governance tracks used by Polkadot and Kusama. |
| **Custom governance systems** | Protocol-specific mechanisms including Nouns-style governance, bespoke voting contracts, futarchy implementations, and other systems that do not fit a single shared standard. |

This taxonomy is non-exhaustive. The architectural implication is that FlexGov
should normalise evidence through an adapter for each governance family, rather
than build a separate analytical system for every DAO. Individual communities
remain configurable within the relevant family, while the analytical layer
receives a legible, source-labelled proposal and vote format.

## Voting-Type Vulnerability Matrix

Once proposals are normalised, the relevant vulnerabilities depend on the
*voting type* rather than the governance family. The matrix below maps each
ballot type FlexGov models to its most characteristic vulnerabilities and the
detection signal used to observe each. This is a working draft (2–3 rows per
type), not an exhaustive claim.

| Voting type | Vulnerability | Detection signal |
|---|---|---|
| **single-choice** | Whale decides outright | largest-wallet share / Gini |
| | Quorum capture (buy just enough) | quorum progress + minimum controlling coalition |
| | Late acquisition | late-influence (share of weight arriving near deadline) |
| **basic** (For/Against/Abstain) | Whale dominance | largest-wallet share |
| | Quorum padding via Abstain | quorum progress + turnout |
| | Late influence | late-influence |
| **approval** (pick many, full VP each) | Bloc voting — identical approval sets | collusion detector (approval-keyed) |
| | Sybil padding a slate | Sybil burst |
| | Whale approves its own slate | largest-wallet share |
| **ranked-choice** (IRV) | Coordinated identical rankings (incl. spread-out "rainbow") | collusion detector (ranked-keyed) |
| | Whale first-preference dominance | largest-wallet share on primary choice |
| | Sybil cluster, identical orderings | Sybil burst |
| **weighted** (split VP) | Near-identical weight distributions (collusion) | collusion detector (weighted, tolerance-bucketed) |
| | Whale's split still dominates | largest-wallet share |
| **quadratic** (sqrt) | Sybil splitting — split one holder into many to beat the square-root dampening (quadratic voting's signature weakness) | Sybil burst + duplicate-timestamp ratio |
| | Coordinated identical ballots | collusion detector |

The practical implication is that detection must be *voting-type aware*: a
signal that indicates abuse under one type is normal behaviour under another
(for example, many identical single-choice ballots are expected, whereas many
identical full rankings are suspicious). This motivates a `voteType` field on
each normalised proposal so the engine can select the applicable detectors.

## Temporal Coordination and Evasion

Exact-second collisions and voting bursts are worth surfacing, but timing alone
cannot establish common control, collusion, or Sybil participation. A detector
based on one public threshold would also be easy to evade by delaying votes or
slightly varying ballot contents.

To resist gaming, the eventual detector should combine:

- multiple time windows: 1, 5, 30 and 300 seconds;
- exact and near-similar approval or ranked ballots;
- voting-power similarity;
- unusually low ballot diversity inside a time cluster;
- later, wallet age, funding links and historical behaviour.

These measurements should remain decomposable and visible. A flagged temporal
cluster is evidence for inspection, not proof of identity linkage or wrongdoing.

## Ideal Governance Health Report

FlexGov's principal product output should be a reproducible Governance Health
Report rather than an unexplained risk score or an instruction to accept or
reject a proposal. The report supplies evidence and comparisons; humans retain
authority unless their community has separately adopted a pre-authorised policy.

An ideal full report contains:

1. **Proposal identity and scope:** governance system, DAO, proposal ID, voting
   type, choices, voting window, execution state, affected contracts and
   treasury value where available.
2. **Participation and concentration:** voter count, eligible-member turnout,
   quorum progress and margin, largest-wallet share, top-three share, Gini
   coefficient, minimum controlling coalition and delegation concentration.
3. **Temporal and behavioural evidence:** late voting, late acquisition of
   voting power, first-time voters, multi-window timing clusters, ballot
   similarity, voting-power similarity and historical wallet behaviour.
4. **Proposal and execution characteristics:** treasury percentage affected,
   new privileged addresses or permissions, forum discussion activity,
   timelock, veto or circuit-breaker availability, and the delay between
   approval and execution.
5. **Historical comparison:** proposal-level signals compared with an
   appropriate DAO and proposal-type baseline, including sample size and
   percentile methodology.
6. **Ballot interpretations and counterfactuals:** the recorded result, a
   first-selection plurality view, a full approval tally where applicable, and
   explicitly defined alternative weighting mechanisms. Unlike mechanisms must
   not be silently averaged.
7. **Findings and suggested actions:** observable findings remain separate from
   optional responses such as requesting explanation, notifying a council,
   opening review, or applying a previously authorised delay.
8. **Data availability and limitations:** every missing source, unsupported
   inference and experimental method is stated rather than represented as zero.
9. **Reproducibility and provenance:** source references, input hash, report
   hash, engine and configuration versions, calculation timestamp, storage
   reference and any compute or onchain attestation.

The machine-readable and human-readable versions must describe the same report.
The complete report may be stored offchain while a compact digest and provenance
record are attested onchain. Such an attestation proves which inputs, code and
configuration produced the report; it does not prove that an interpretation is
correct.
