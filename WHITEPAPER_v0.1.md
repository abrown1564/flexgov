# FlexGov: Governance Observability and Adaptive Safeguards

## Whitepaper v0.1

> **Working Draft — 25 July 2026**  
> This document defines the current argument, design boundaries, and evaluation programme for FlexGov.

> **IMPLEMENTATION NOTE — VISION DOCUMENT, NOT A CLAIM THAT EVERY FEATURE IS IMPLEMENTED**
> This whitepaper was drafted at the beginning of ETHGlobal Lisbon 2026, building on earlier academic research and a broader programme of ideas about adaptive governance. It therefore combines a specification of the working hackathon MVP with an aspirational research and product roadmap. The submitted MVP is an **advisory governance-observability system**: it measures concentration and timing signals, compares the same observed ballots under four disclosed weighting transformations, reports outcome robustness and missing data, produces canonical SHA-256-verifiable reports, supports on-demand Snapshot exploration, and demonstrates a reproducible Compound Governor report sourced through The Graph. It does **not** currently identify unique humans, detect late token acquisition, run machine-learning or AI judgments at runtime, change a DAO's voting rule, enforce a timelock, attest reports onchain, or autonomously stop an execution. Sections describing those capabilities should be read as proposed designs and open research questions unless explicitly marked implemented.

### Status at a glance

| Status | Scope |
| --- | --- |
| **Implemented in the submitted MVP** | Deterministic concentration and timing measurements; 1T1V, square-root, 1W1V, and experimental Gini-adaptive counterfactuals; `robust` / `contested` / `rule-dependent` classification; data-availability disclosures; canonical source/configuration/report hashes; on-demand Snapshot exploration; pinned reports; Compound Governor proposal 393 sourced through The Graph with quorum, lifecycle, contract-action, and provenance evidence |
| **Experimental** | Gini-adaptive dampening (`weight^(1−G)`); interpretation of timestamp concentration; thresholds used to produce advisory findings |
| **Proposed design / research agenda** | Binding Ensemble and Flex policies; automatic rule replacement; configurable enforcement; ILS; Mixed Strategy Mode; machine-learning detection; identity-backed voting; verifiable compute; token-acquisition and funding-provenance monitoring |
| **Unavailable or not connected in the MVP** | Unique-person identity; authoritative eligible-member turnout for current sources; late token-acquisition history; wallet funding relationships; runtime AI interpretation; content-addressed storage; onchain attestation; autonomous enforcement |

## What is FlexGov?

FlexGov is an advisory governance-observability framework for decentralised organisations. The submitted MVP shows who participated and with how much cast voting power, measures how concentrated that participating power was, compares the same observed ballots under different disclosed weighting assumptions, and produces a reproducible Governance Health Report. Where authoritative inputs are unavailable—such as eligible-member turnout, token-acquisition history, or wallet funding relationships—the report marks them unavailable rather than guessing.

Its longer-term security thesis is economic. Governance attacks may be attractive when winning a vote costs less than the assets the vote controls: reporting on the BonkDAO incident indicates that an attacker spent roughly $4.4 million and directed approximately $20 million from the treasury. FlexGov's research objective is to help communities make capture more visible, slower, less certain, and ultimately more expensive than its expected payoff. This deterrence thesis is a design goal, not an effect demonstrated by the current MVP. **Deterrence, not fortification.**

Three proposed design moves carry this longer-term thesis:

1. **Adaptive rule selection.** When manipulation signals appear, FlexGov can pivot the effective voting rule under a pre-authorised policy—governed by one principle: *the rule that decides a flagged vote must never reward the behaviour that raised the flag.* Detected concentration pivots toward concentration-dampening rules; detected wallet-splitting pivots toward linear, splitting-neutral rules. The attack vector selects its own countermeasure.
2. **Responses robust to ambiguity.** The system does not need to diagnose an attack correctly to respond correctly. Escalation—warnings, challenge windows, timelocks, review—fires on anomaly, not on attribution, so an attacker gains little by disguising one attack as another.
3. **A moving target.** Policies, thresholds, and detectors recalibrate between proposals. An adversary optimising against FlexGov faces uncertainty about what will trigger, converting a calculable heist into a gamble with locked capital.

The consequence is that evasion itself becomes the deterrent. An attacker avoiding the whale signals must split across many wallets, fund them from mixed sources, and accumulate slowly—spending more, waiting longer, locking capital at market risk, and leaving a wider evidentiary trail, with escalation and review still waiting at the end. Every costume costs.

The deterrence thesis is intended to become measurable: for a future configured policy, one could estimate the cheapest attack that defeats every layer and compare it with the payoff it seeks. No attack-cost inflation factor has yet been established for the MVP. The longer-term success criterion is pushing that cost above the value it protects (see §12 and [Mathematical_questions.md](./Mathematical_questions.md)).

FlexGov does not prescribe one model of fair governance. Communities configure the mechanisms, thresholds, and responses; FlexGov makes those choices explicit, testable, and enforceable to exactly the degree the community authorises. The remainder of this document sets out the argument, architecture, and open questions in full.

## Abstract

Decentralised governance makes collective decisions executable through software, but it also exposes communities to concentrated voting power, low-participation quorum capture, borrowed or purchased influence, delegation capture, Sybil participation, coordinated behaviour, and rapid execution of harmful proposals. Individual voting mechanisms mitigate some of these problems while introducing others.

FlexGov is a governance-observability and adaptive-safeguards framework. The submitted MVP measures concentration and timing signals in observed ballots, compares the recorded result with conditional counterfactual outcomes under alternative weighting assumptions, and produces an advisory, reproducible report. Pre-authorised escalation and enforcement are proposed policy layers rather than capabilities exercised by the current deployment.

> **FlexGov does not decide what fairness means for every community. It lets communities encode their own safeguards, detects when those safeguards are threatened, and shows whether an outcome survives alternative governance assumptions.**

The MVP supports advisory analysis, transparent measurements, 1T1V, square-root and 1W1V counterfactual stress tests, an experimental Gini-adaptive transformation, outcome-robustness classification, and deterministic threshold findings. A future DAO deployment may authorise review or binding rule replacement, but only through a policy adopted before voting begins and an external system with enforcement authority.

## 1. Problem

Token governance can convert economic ownership directly into political authority. This provides a simple and legible rule, but it also means that a sufficiently capitalised participant may dominate a low-turnout vote, buy or borrow enough voting power to meet quorum, or capture delegated influence.

Recent and historical incidents illustrate different parts of the threat:

- The 2022 Beanstalk attack used flash-borrowed governance power to pass a malicious proposal and extract protocol assets.
- The 2022 Mango Markets incident primarily involved market and oracle manipulation rather than a vote-based treasury exploit; its later governance activity should not be conflated with the original exploit.
- Vote-influence markets have demonstrated that substantial delegated voting power can sometimes be obtained for far less than its nominal token value.
- The July 2026 BonkDAO incident reportedly involved an attacker purchasing enough BONK to satisfy a low quorum and controlling nearly all voting weight in the proposal that transferred treasury assets.

These incidents do not establish that every concentrated or unusual vote is malicious. They show that governance systems need better visibility into concentration, timing, quorum, eligibility, delegation, and execution risk.

Existing responses are fragmented. Identity systems address some Sybil risks. Quadratic and conviction voting alter the allocation rule. Timelocks delay execution. monitoring tools detect events. Governance interfaces facilitate proposals and ballots. Each may be useful, but none supplies a neutral, configurable layer for comparing assumptions and escalating suspicious outcomes across mechanisms.

## 2. Threat Model

FlexGov considers adversaries who may:

- purchase, borrow, rent, or receive delegated voting power;
- split activity across wallets;
- coordinate voting choices and timing;
- create ineligible or pseudonymous participants where eligibility controls are weak;
- exploit low turnout or quorum definitions;
- acquire voting power shortly before a snapshot or deadline;
- manipulate adaptive triggers;
- compromise delegates, administrators, or oracle inputs;
- exploit differences between proposal approval and execution;
- poison or evade machine-learning detection.

FlexGov does not assume that token concentration, clustered timestamps, new wallets, dissent, or anomalous behaviour proves malicious intent. These are signals that may justify explanation, review, delay, or a previously authorised response.

## 3. Design Principles

### 3.1 Community Constitutional Choice

Communities define their own eligible mechanisms, thresholds, weights, escalation procedures, and authority boundaries. FlexGov makes those choices explicit and testable.

### 3.2 Legibility

Every high-level score must decompose into observable measurements. Users should be able to see whether a warning came from concentration, turnout, timing, eligibility, delegation, model output, or outcome sensitivity.

FlexGov should not become a new governance black box. A community must not be asked to trust an unexplained integrity score, anomaly label, or model recommendation—particularly when that output may delay execution, trigger review, or change the applicable voting rule. Every consequential output should expose the evidence that produced it, the calculation or model involved, the uncertainty attached to it, and the community-defined policy that converts the signal into a response. Machine-learning outputs may contribute to the analysis, but they must remain distinguishable from directly observed facts and open to inspection and challenge.

### 3.3 Counterfactual Humility

An alternative voting result is not “the fair result.” It is a conditional statement: the outcome that follows if a different governance assumption is applied to the available data.

### 3.4 Predictability

Binding adaptive rules must be adopted before voting begins. Participants should know the possible triggers and consequences. Advisory analysis may be performed after the fact, but it must not be presented as retroactive constitutional authority.

### 3.5 Separation of Analysis and Enforcement

FlexGov distinguishes:

1. measuring risk;
2. explaining evidence;
3. recommending or triggering review;
4. delaying execution;
5. replacing a rule;
6. executing a result.

Each step requires progressively stronger authorisation.

### 3.6 Privacy and Contestability

Governance analysis should collect no more data than it needs. Participants must be able to inspect and contest material automated conclusions. Minority positions must not be classified as manipulation merely because they differ from a majority or model consensus.

## 4. FlexGov Architecture

This section combines the implemented analytical core with proposed policy and governance layers. Sections 4.1–4.4 describe the architecture that the MVP partially implements; Sections 4.5–4.8 describe future constitutional and enforcement designs unless stated otherwise.

### 4.1 Data Layer

The MVP normalises proposals, choices, cast voting power, timestamps, and source provenance from supported governance sources. Snapshot supplies proposal and ballot data for on-demand exploration and pinned reports. The Graph-backed Compound report additionally supplies authoritative Governor quorum, queue/execution lifecycle, contract actions, and indexed-block provenance. Delegation history, token-acquisition history, wallet funding relationships, and broadly comparable eligible-member turnout remain future data connections.

### 4.2 Detection Layer

The detection layer calculates implemented transparent measurements such as largest-wallet and top-k voting shares, Gini concentration, minimum wallets controlling half of cast weight, late-cast voting power, and timestamp clustering. Depending on the connected source, it can also report authoritative quorum progress. The following remain part of the wider intended signal set rather than uniformly available MVP outputs:

- voting-power changes near snapshots or deadlines;
- wallet-age and provenance indicators;
- delegation concentration;
- eligible-member turnout.

Machine-learning anomaly detection remains an important research path.

### 4.3 Counterfactual Layer

FlexGov evaluates each supported mechanism independently:

- **1T1V:** one token, one vote;
- **QV stress test:** the square root of each observed ballot's cast voting power;
- **1W1V:** one eligible wallet, one vote;
- **Experimental Gini-adaptive dampening:** each observed ballot weight `w` is transformed to `w^(1−G)`, where `G` is the Gini coefficient of the observed cast weights. At `G = 0` it matches token weighting; as `G` approaches 1 it approaches equal weight per participating wallet. The MVP uses this as an experimental counterfactual stress test, not as a recommended or universally fair voting rule.

One wallet, one vote is not one person, one vote. Identity-backed 1P1V requires a separate proof-of-personhood system. The difference is not merely technical: it is a constitutional choice about whether the community treats a wallet as a proxy for a person, and communities adopting 1W1V should make that assumption explicit.

These mechanisms differ along a single axis with a known trade-off. Any tally rule more egalitarian than linear token weighting—QV, 1W1V, capping, Gini-norming—rewards dividing a stake across wallets, because the rule squashes large wallets and wallets are not people. Plain 1T1V is the only splitting-neutral rule: splitting a holding changes nothing, but it also dampens nothing. Mechanism choice therefore shifts the attack surface rather than removing it, which is why FlexGov pairs rule selection with detection, and why Flex Mode's selection principle (§4.6) never assigns a flagged vote to a rule that rewards the behaviour that was just detected. A formal treatment of splitting incentives is recorded in [Mathematical_questions.md](./Mathematical_questions.md).

The counterfactual layer displays results side by side. Ensemble Mode may aggregate their categorical outputs, but it does not average incomparable raw vote totals.

### 4.4 Robustness Layer

The MVP classifies the recorded winner across its four tested weighting transformations as:

- **robust:** every tested transformation selects the same winner;
- **contested:** the transformations disagree, but the recorded rule's winner still wins under a majority of tested rules;
- **rule-dependent:** the recorded rule's winner loses under most tested alternatives;
- **not available:** there are no votes or an exact tie prevents comparison.

These labels describe only the disclosed comparison suite and observed ballots. They are not universal statements about legitimacy or predictions of how participants would vote under a different institutional rule. Broader robustness definitions remain open in [Mathematical_questions.md](./Mathematical_questions.md).

### 4.5 Policy Layer

**Status: proposed policy and enforcement design.** The current MVP produces advisory reports and deterministic findings; it does not execute any of the following actions. A future DAO deployment may configure an authorised policy that:

- emits a warning;
- opens a challenge window;
- activates a timelock;
- requires guardian or multisig review;
- calls for a new ballot;
- recounts under a pre-authorised alternative rule;
- automatically replaces the rule when fully specified conditions are met.

Automatic rule replacement is compatible with FlexGov's adaptable and modular purpose when the DAO has authorised it in advance. The triggering data, thresholds, replacement rule, ballot treatment, appeals, and execution consequences must all be defined before voting.

### 4.6 Modes

The names below describe a mixture of implemented analysis and future designs:

- **Ensemble comparison — implemented analytically; binding meta-voting proposed:** the MVP runs four weighting transformations in parallel and reports agreement or mechanism sensitivity. It does not aggregate them into a binding meta-vote.
- **Flex Mode — proposed:** would apply a pre-authorised deterministic response or rule-selection policy. Its proposed selection principle is that the rule deciding a flagged vote should not reward the behaviour that raised the flag.
- **Modular Mode — proposed configuration layer:** would allow a community to select mechanisms, detectors, thresholds, and responses.
- **ILS Mode — proposed research direction:** would apply an Information Level Score to recognise evidence of informed and deliberative participation.
- **Mixed Strategy Mode — proposed research direction:** would use verifiable randomness to select among pre-authorised voting mechanisms according to a configurable probability distribution.

An illustrative Flex Mode policy, with every threshold, rule, and parameter community-configured and adopted before voting begins:

```text
if signals == {whale_concentration} and no splitting signals:
    rule = Gini-normed 1T1V          # dampening punishes what was detected
elif splitting or Sybil signals present:
    rule = 1T1V (splitting-neutral)  # never 1W1V or QV: they reward the detected behaviour
    escalate: review                 # or human-backed 1P1V where proof-of-personhood exists
elif signals == {delegation_capture}:
    response = suspend delegation for this vote; count direct ballots; review
if multiple conflicting signals, or any signal near threshold:
    escalate: review + timelock      # ambiguity is a signal; do not auto-pivot
```

The policy illustrates the selection invariant: *the selected rule must make the detected behaviour worthless.* Note that a real policy must be defined over signal combinations rather than single signals—an adversary evading one threshold typically raises others—and ambiguous or conflicting signals should escalate to review rather than trigger an automatic pivot. The design of policy tables over combined signals is an open task recorded in [Mathematical_questions.md](./Mathematical_questions.md).

### 4.7 Information Level Score (ILS) Mode

**Status: proposed research direction; not implemented in the MVP.**

Information Level Score (ILS) Mode is FlexGov's proposed mechanism for recognising the informational quality of participation, rather than measuring influence solely through token ownership, address count, or expressed preference. It asks a limited but important question: **what evidence exists that a participant engaged meaningfully with the decision before casting a ballot?**

ILS draws from deliberative-democratic principles, under which legitimate collective decisions depend not only on aggregating preferences but also on participants encountering reasons, evidence, and competing perspectives (Dryzek, 2000). Its purpose is not to determine whether a voter reached the “correct” conclusion. It is to distinguish a ballot accompanied by demonstrable engagement from one cast without any observable encounter with the substance of the proposal.

An ILS would be attached to a ballot or eligible participant and calculated from a community-approved set of evidence. Candidate components may include:

- performance on proposal-specific knowledge checks;
- demonstrated exposure to arguments and evidence supporting more than one position;
- substantive contributions to deliberation, including questions, objections, evidence, or reasoned replies;
- engagement with relevant technical documentation, implementation materials, or governance history;
- revision, qualification, or justification of a position after reflection;
- relevant contributions to the proposal or the systems affected by it.

Raw activity is not equivalent to informed participation. Time spent on a page, documents opened, comments posted, wallet age, writing style, or volume of text may be easy to measure, but each is also easy to game and may reproduce social, educational, linguistic, or accessibility inequalities. These signals should not independently establish a high Information Level Score.

One possible structure is a normalised score:

```text
ILS_i = w_k K_i + w_e E_i + w_d D_i + w_r R_i
```

where, for participant or ballot `i`:

- `K` represents demonstrated proposal knowledge;
- `E` represents exposure to relevant and competing evidence;
- `D` represents substantive deliberative contribution;
- `R` represents reflection, revision, or reasoned justification;
- each `w` is a weight selected by the community in advance.

The formula is illustrative rather than final. A DAO could use ILS as a distinct voting mechanism within an Ensemble, as a modifier within another mechanism, or as a threshold for entry into a deliberative stage. If used to modify ballot weight, the transformation from Information Level Score to effective influence must be bounded, visible, and adopted before voting begins. A high ILS should not grant unlimited authority, and a low score should not automatically eliminate a participant's political voice.

ILS must remain content-neutral with respect to the participant's conclusion. The system should evaluate evidence of informed engagement, not ideological agreement, popularity, deference to experts, grammatical fluency, or alignment with an AI-generated answer. Minority and dissenting positions may be highly informed; consensus may be poorly informed.

This requirement does not undermine the validity of delegation, liquid democracy, or any other mechanism a community chooses. A DAO may legitimately decide that trust, expertise, representation, or delegated judgment should carry authority; ILS simply must not silently substitute those criteria for informed engagement when calculating an information score. This distinction reflects FlexGov's core philosophy: no single voting mechanism is assumed to be universally correct. Communities may adopt delegation as their electoral rule, use ILS separately or alongside it, or exclude ILS entirely, provided the relationship between the mechanisms is explicit and agreed in advance.

ILS may also support a deliberative response to mechanism-sensitive outcomes. Where the same proposal produces materially different results under different authorised mechanisms, a DAO may pre-authorise that disagreement as a deliberation trigger rather than forcing an immediate resolution. The community could reopen discussion, request amendments, consult affected groups, commission further evidence, or activate another agreed decision model. The trigger would not imply that one mechanism is correct and the others are defective; it would recognise that the outcome depends on unresolved assumptions about representation, influence, or collective choice.

Because any operational definition of “informed” embeds political and epistemic judgments, communities must be able to inspect and amend the component definitions, weights, evidence sources, privacy rules, and appeal process. Participants should be able to understand why a score was assigned, challenge incorrect evidence, and know which observations were unavailable. Private reading behaviour and off-chain participation should not be collected merely because they are technically measurable.

ILS therefore changes the source of voting influence but does not solve legitimacy automatically. Its central research questions concern measurement validity, gaming resistance, privacy, accessibility, cultural and linguistic bias, the treatment of anonymous participation, and whether informational weighting improves decisions without creating a new credentialed elite.

### 4.8 Mixed Strategy Mode

**Status: proposed research direction; not implemented in the MVP.**

Mixed Strategy Mode is FlexGov's proposed stochastic approach to mechanism selection. Instead of committing every proposal to one predictable voting rule, the DAO authorises a set of eligible mechanisms and a method for assigning each one a probability. A verifiable random draw then determines which mechanism governs the decision.

The rationale is strategic unpredictability. When an attacker knows exactly which rule will apply, they can optimise token acquisition, wallet splitting, delegation, timing, or coordination for that rule. A mixed strategy may raise the cost of manipulation by forcing participants to account for several possible mechanisms rather than one certain target.

A possible probability model is:

```text
P(rule = r) = softmax(score_r / temperature)
```

where:

- `score_r` represents the community-defined suitability or integrity assessment for mechanism `r`;
- `temperature` controls how concentrated or dispersed the probabilities are;
- a lower temperature favours the highest-scoring mechanisms more strongly;
- a higher temperature produces a more even distribution.

This expression is illustrative. A DAO may instead use fixed probabilities, threshold-based probability bands, equal probabilities, or another published rule. The critical requirement is that the eligible mechanisms, probability calculation, parameters, data sources, and randomness process are defined before the decision.

Mixed Strategy Mode should not be confused with Ensemble Mode. Ensemble Mode runs several mechanisms and aggregates their categorical outputs through a meta-vote. Mixed Strategy Mode selects one mechanism from an authorised distribution and applies that mechanism as the decision rule. A DAO could nevertheless combine the modes—for example, randomly selecting among several preconfigured Ensembles—but doing so would add further complexity that must be made legible.

A binding Mixed Strategy policy must define:

- the mechanisms eligible for selection;
- whether probabilities are fixed or responsive to observable conditions;
- the calculation and parameters used to produce those probabilities;
- the verifiable randomness source;
- when the mechanism is selected and when it is revealed;
- whether voters cast one reusable ballot or separate mechanism-specific ballots;
- how eligibility, quorum, abstention, delegation, and indeterminate results work under every eligible mechanism;
- what happens if the randomness or computation service is unavailable;
- challenge, appeal, timelock, and emergency procedures.

The timing of selection creates an important design trade-off. Selecting and revealing the rule before voting gives participants clarity but reduces unpredictability. Selecting after ballots are committed may preserve unpredictability but requires ballots that can be interpreted legitimately under every eligible mechanism. Commit–reveal or cryptographic approaches may offer intermediate designs, but they introduce their own usability and implementation risks.

Verifiable randomness can prove that a draw followed the declared process. It cannot prove that the candidate mechanisms, probability distribution, or resulting decision were fair or legitimate. A random process may still select a mechanism poorly suited to the proposal, and a known probability distribution may simply cause an attacker to optimise expected payoff across all possible rules.

Mixed Strategy Mode therefore requires evidence that stochastic selection improves manipulation resistance relative to fixed-rule governance and deterministic Flex Mode responses. Its open questions include strategic behaviour under known distributions, the comparability of eligible ballots, manipulation of mechanism scores, community acceptance of stochastic authority, and whether increased attack cost justifies the accompanying complexity.

## 5. Detection Methodology

The detection methodology begins with explainable deterministic measurements because they are reproducible and easy to audit.

| Risk or question | Initial measurement | MVP status and interpretation |
|---|---|---|
| Whale dominance | Largest-wallet share, top-k share, Gini coefficient | **Implemented.** Describes concentration; does not prove abuse or causal pivotality |
| Quorum capture | Authoritative quorum progress and participating-wallet count | **Source-dependent.** Available in the Compound Governor report; unavailable for current Snapshot reports where no authoritative target is supplied |
| Late voting | Share of cast weight arriving late in the voting window | **Implemented.** Measures ballot timing, not when the voter acquired the underlying token or delegation |
| Late acquisition | Change in voting power near snapshot or deadline | **Not connected.** Requires historical token or delegation data |
| Temporal coordination | Exact-timestamp and clustering measures | **Implemented as an inspectable signal.** Timing alone does not prove common control, collusion, or Sybil activity |
| Sybil exposure | Wallet provenance, funding and behavioural similarity | **Not connected.** Cannot establish unique humans |
| Delegation capture | Delegate share and minimum controlling coalition | **Partially available at most; not a general MVP detector.** Describes representative concentration where authoritative data exists |
| Mechanism sensitivity | Outcome comparison across four disclosed transformations | **Implemented.** Shows dependence on the tested assumptions and observed ballots |

A full matrix must connect every supported voting method to its vulnerabilities, observable signals, data, calculations, thresholds, uncertainty, response, and implementation status. That matrix is a required design task, not a completed claim.

### Machine Learning

Isolation Forest and other anomaly-detection methods may identify multivariate patterns missed by individual thresholds. Their importance is likely to grow when FlexGov has sufficient cross-proposal and cross-DAO data.

The approach has empirical support from the author's prior research (Pateman-Brown, 2025), which applied a bootstrap-validated Isolation Forest to a real ENS governance proposal of approximately 1,200 ballots. Anomaly rankings proved highly reproducible under data perturbation—median Spearman rank-correlation ρ = 0.79 (IQR 0.75–0.82) across thirty .632-bootstrap replicas—and the resulting tiered rule pivot reduced winner-side Gini concentration from 0.98 to 0.89 at negligible computational cost. These are single-proposal, label-free, proof-of-concept results: they demonstrate the feasibility and stability of the detection-and-pivot approach, not detection accuracy against ground-truth attacks, which requires the evaluation programme in §10.

ML output must be compared against deterministic baselines, tested across time and DAOs, explained in terms of contributing features, and protected against evasion and data poisoning. A model flag is evidence for inspection—not proof of wrongdoing.

## 6. Counterfactual Analysis

Counterfactual analysis asks whether a proposal would have passed under another explicitly defined mechanism. It should report:

- the input population and snapshot;
- the transformation applied by each rule;
- quorum and abstention treatment;
- missing identity or eligibility information;
- the resulting support, opposition, and margin;
- whether the direction of the outcome changes;
- which participants or assumptions drive that change.

For the BonkDAO narrative case study, FlexGov uses reported facts to explain which measurements and comparisons would have been relevant. The submitted product does not present BonkDAO as a Graph-derived canonical report and does not claim a verified alternative winner. It cannot claim that 1W1V represents unique humans, nor that a counterfactual alone would have stopped execution. Prevention requires a previously installed policy with enforcement authority.

### 6.1 Case Study: The BonkDAO Attack (July 2026)

**The incident.** On 6 July 2026, an attacker spent approximately $4.4 million purchasing just over 1% of BONK's supply, satisfying BonkDAO's 1% quorum threshold. Proposal "BIP #76" passed with seven wallets voting out of more than 18,000 members; the attacker controlled 99.878% of the voting weight. The proposal transferred approximately $20 million of treasury assets to the attacker's wallet. No smart contract was exploited—every transaction was permitted by the governance system (Malwa, 2026; Behnke, 2026).

**What the reported case indicates FlexGov should measure.** Largest-wallet share: 99.878%. Participation: seven wallets; reports describe this as roughly 0.04% of the stated community membership. Quorum: reportedly met by a single recently acquired position. The submitted MVP can represent the concentration evidence, but it does not currently connect the authoritative BonkDAO electorate, token-acquisition history, or execution data needed to reproduce every figure as a canonical report.

**What a fully connected FlexGov deployment could have signalled.** The reported facts point to extreme concentration, very low participation, quorum capture, and late acquisition. The current MVP can calculate concentration from a complete ballot set and can report authoritative quorum where the connected source supplies it; it cannot yet independently verify BonkDAO's eligible-member turnout or acquisition history. No machine learning is required to inspect the reported concentration pattern.

**What counterfactual analysis could test.** Under 1W1V, the attacker's 99.878% reported weight would become one wallet-unit among seven, but the alternative winner would still depend on the other six recorded ballots and the eligibility assumptions applied to them. Under the MVP's experimental Gini-adaptive transformation, extreme inequality would substantially dampen large weights. Without a complete, authoritative ballot fixture in the submitted report set, FlexGov does not claim a verified BonkDAO robustness classification or outcome reversal.

**What a pre-installed policy could have done.** Under a pre-authorised escalation policy, this signal profile triggers review and a timelock before execution, giving the community days—and explicit, decomposable evidence—before the transfer.

**What FlexGov cannot claim.** Analysis alone would not have stopped the transfer; prevention requires enforcement authority installed before the vote (§3.5, §11). The defensible MVP claim is narrower: the reported concentration pattern is precisely the kind of evidence a governance-observability system should surface before execution. Whether a configured policy would have prevented the incident or increased its cost remains a counterfactual research question.

## 7. Cross-Domain Defensive Techniques

Governance security can learn from elections, institutional checks, fraud prevention, financial controls, and web-platform security.

| External practice | FlexGov analogue | Limitation or design question |
|---|---|---|
| Voter registration | Eligibility credentials or voting snapshots | Who defines eligibility, and who may be excluded? |
| Electoral-roll deduplication | Sybil-resistant participant registry | Wallets are not people; identity systems introduce new dependencies |
| Secret ballot | Encrypted voting, commitments, or MACI-style privacy | Privacy can make public coordination analysis harder |
| Election observers | Independent governance monitors | Observers require access, competence, and community trust |
| Recounts and risk-limiting audits | Reproducible tally and counterfactual recomputation | Smart-contract state and off-chain inputs must be reproducible |
| Certification period | Timelock between approval and execution | Delay helps only if someone can challenge or intervene |
| Separation of duties | Separate proposer, voter, reviewer, and executor roles | More roles can create coordination and capture risks |
| Mail-ballot signature and envelope checks | Layered eligibility and ballot-validity proofs | Digital identity and key compromise remain distinct problems |
| Fraud scoring | Multi-signal wallet and vote-risk analysis | False positives require explanation and appeal |
| Rate limiting | Limits on proposals or actions per credential/window | Can impede legitimate participation |
| Financial transaction monitoring | Funding-provenance and sudden-balance-change alerts | Provenance does not establish intent |
| Cooling-off periods | Delay after acquiring or receiving voting power | May penalise legitimate new participants |
| Judicial or administrative appeal | Guardian, community challenge, or review window | The reviewer must not become an unaccountable veto point |
| Constitutional amendment procedures | Pre-authorised mode and threshold changes | Policies should not change opportunistically during a live vote |

No analogy transfers perfectly. The purpose of the mapping is to identify reusable institutional patterns: layered controls, independent review, delayed finality, separation of duties, auditability, and appeal.

## 8. Philosophical and Political Foundations

FlexGov is not politically neutral in the sense of having no underlying commitments. Its architecture favours community self-government, contestable authority, institutional experimentation, transparent reasons, and safeguards against concentrated or unaccountable power. It does not, however, prescribe one complete theory of democracy or claim that a technical system can resolve every disagreement about legitimacy.

### 8.1 ⿻ Plurality

FlexGov draws on the concept of **⿻ Plurality** developed by E. Glen Weyl, Audrey Tang, and the Plurality community. In this usage, Plurality does not mean the ordinary electoral rule under which the option with the most votes wins. It means **technology for collaboration across social difference**: an approach that understands society neither as a collection of isolated individuals nor as one homogeneous whole, but as a fabric of diverse, intersecting affiliations and communities (Weyl, Tang and Plurality Community, 2024).

The concept has descriptive, normative, and prescriptive dimensions. Descriptively, people and institutions are constituted through overlapping relationships and affiliations. Normatively, diversity can generate social learning and progress when differences are connected without being erased. Prescriptively, digital systems should help people cooperate across those differences while resisting both atomised individualism and centralised technocratic control.

FlexGov supports this conception in several ways:

- **Mechanism pluralism:** no single voting mechanism is assumed to be universally correct. Different mechanisms embody different judgments about equality, stake, knowledge, intensity, representation, and time.
- **Community constitutional choice:** communities can select mechanisms, thresholds, safeguards, weights, and responses appropriate to their own purposes rather than inheriting one universal governance model.
- **Ensemble and counterfactual analysis:** multiple governance mechanisms can evaluate the same proposal, while disagreement between their outputs remains visible instead of being concealed by a single score.
- **Deliberative escalation:** a mechanism-sensitive result can trigger further discussion, amendment, consultation, evidence gathering, or another pre-agreed decision process.
- **Legibility and contestability:** high-level conclusions must decompose into observable evidence and configured judgments, preventing an algorithm or AI system from becoming an unaccountable source of political authority.
- **ILS Mode:** informed engagement, exposure to competing evidence, and reasoned participation can be recognised without requiring ideological agreement or treating consensus as proof of knowledge.
- **Modularity and adaptation:** communities can revise their institutional arrangements as circumstances and shared understanding change.

Ensemble Mode is pluralist only if its component mechanisms represent meaningfully different governance assumptions. Counting several closely related mechanisms as independent meta-votes could create false plurality. FlexGov should therefore disclose relationships between mechanisms, preserve minority and indeterminate outputs, and treat robustness as distinct from the binding Ensemble decision.

FlexGov does not yet realise the whole ⿻ programme. Its present emphasis is governance observability, electoral integrity, mechanism comparison, and adaptable safeguards. A fuller implementation would also support collaborative agenda-setting, proposal co-design, structured deliberation, minority reports, multilingual and accessible participation, privacy-preserving recognition of overlapping communities, and contributions that build bridges across otherwise distinct groups. Voting remains only one layer of collective intelligence; it cannot substitute for the richer communication and collaboration through which preferences and proposals are formed.

FlexGov can therefore be described as applying ⿻ Plurality primarily to the **constitutional and analytical layer** of digital governance: it allows multiple models of legitimacy to coexist, makes disagreement between them legible, and gives communities authority to determine how those models interact. Its longer-term opportunity is to extend that plurality from voting mechanisms into the social and deliberative processes surrounding collective decisions.

### 8.2 Digital Commons and Institutional Design

DAOs govern shared treasuries and shared protocols—common-pool resources in Ostrom's sense—and they face the classic commons problems of defining boundaries, monitoring behaviour, and enforcing agreed rules (Ostrom, 1990). Ostrom's design principles for enduring commons institutions map with striking directness onto FlexGov's architecture: monitoring by accountable monitors corresponds to the observability layer; **graduated sanctions correspond to the escalation ladder**, in which warnings precede review, review precedes delay, and delay precedes any binding consequence; collective-choice arrangements correspond to community constitutional choice; and accessible conflict-resolution mechanisms correspond to challenge windows and appeals. FlexGov also inherits the older constitutionalist insight behind separation of powers: concentrated, unchecked authority tends toward abuse regardless of who holds it, so proposer, voter, reviewer, and executor should be distinct roles with distinct authorisations (§3.5, §7).

Digital commons nevertheless differ from Ostrom's fisheries and irrigation systems: participants are pseudonymous, exit is nearly free, and boundaries are contestable by design. FlexGov should be read as an attempt to supply the monitoring and graduated-sanction layers that Ostrom found essential, under conditions where the traditional social enforcement mechanisms—reputation, proximity, repeated interaction—are weak or absent.

### 8.3 Condorcet and the Conditions for Collective Competence

Condorcet's Jury Theorem (1785) states that, under its assumptions, majority decisions become more likely to be correct as the number of voters grows, provided voters are independently informed and each is more likely than not to choose well. The theorem is frequently cited as a defence of broad participation; it is less often noticed that its **assumptions are precisely what governance attacks destroy**. Sybil participation manufactures correlated votes that masquerade as independent ones. Vote buying replaces a voter's judgment with a purchaser's. Whale concentration reduces the effective number of independent voters toward one, whatever the nominal turnout.

FlexGov's detection layer can therefore be understood as **defending the Jury Theorem's assumptions rather than assuming them**: correlation and coordination signals guard independence; turnout and quorum signals guard the effective number of voters; provenance signals guard the presumption that a ballot expresses its caster's judgment. Broad, independent participation is a condition to be verified and protected, not a premise to be taken on faith.

### 8.4 Practice Corrects Philosophy

Matthews (2015) observes that idealised systems can produce perverse consequences when put into practice, and that knowledge institutions improve through feedback between theory and observed behaviour. FlexGov operationalises this principle: every voting mechanism is treated as a **testable hypothesis about legitimacy** rather than a settled ideal. Running mechanisms in parallel, measuring their behaviour on real proposals, classifying outcome robustness, and evaluating detection signals against historical and synthetic attacks together form an empirical feedback loop in which governance theory is corrected by governance practice. The evaluation programme in §10 is this philosophical commitment expressed as a test plan.

### 8.5 Deliberative Democracy

Dryzek (2000) places communication, reasons, and reflection—rather than the mere aggregation of preferences—at the centre of democratic legitimacy. FlexGov reflects this in two places. ILS Mode (§4.7) proposes to recognise evidence of informed and deliberative participation without policing conclusions. And deliberative escalation treats mechanism-sensitive outcomes as an occasion for further discussion, amendment, and consultation rather than forcing an immediate winner—acknowledging that when authorised mechanisms disagree, the disagreement is itself information about unresolved questions of representation and influence that talk, not tallying, must address.

### 8.6 Governance as an Alignment Problem

Russell (2019) argues that powerful optimising systems must remain corrigible and faithful to human values under conditions of uncertainty; Gabriel (2020) asks which values, and whose, an aligned system should encode. FlexGov treats decentralised governance as the same problem in institutional form: a socio-technical system that must remain responsive to plural community values while resisting adversarial drift—whether the adversary is a token whale, a Sybil operator, or the governance layer's own automation. This is why the legibility principle (§3.2) refuses unexplained scores binding authority, why community constitutional choice (§3.1) answers Gabriel's "whose values?" by returning the question to each community, and why the escalation ladder keeps humans in the loop at every rung where authority increases. FlexGov's answer to the alignment question is procedural rather than substantive: it does not encode the correct values; it keeps the encoding visible, contestable, and revocable.

## 9. Governance and Trust Assumptions

FlexGov cannot remove governance from governance. The system depends on decisions about:

- who configures thresholds and mechanisms;
- which data sources and snapshots are authoritative;
- whether a wallet is eligible;
- which identities or credentials are acceptable;
- who can pause or override execution;
- how configuration changes are approved;
- how emergencies and appeals are handled.

These assumptions should be disclosed as part of a DAO's FlexGov policy. A community choosing automatic replacement accepts different risks from one choosing advisory analysis only.

FlexGov should distinguish on-chain facts, statistical inferences, configured value judgments, and external assertions. This prevents a configurable governance policy from being presented as mathematical objectivity.

## 10. Evaluation Plan

FlexGov should be evaluated on historical proposals and controlled synthetic attacks.

### Functional Evaluation

- reproduce the recorded result from indexed vote data;
- calculate each transparent signal correctly;
- reproduce each counterfactual transformation;
- display missing data and unsupported assumptions;
- generate the same report from the same versioned inputs.

### Security and Detection Evaluation

- whale accumulation;
- quorum capture;
- late voting-power acquisition;
- wallet splitting;
- coordinated timing;
- delegation concentration;
- benign high-concentration cases;
- small-DAO participation patterns;
- adversarial attempts to trigger or evade switching policies.

### Product Evaluation

- can a reviewer identify how concentrated participating voting power was?
- can a reviewer explain every warning?
- can a DAO understand why mechanisms disagree?
- can users distinguish 1W1V from 1P1V?
- can a reviewer see whether the output is advisory or enforceable?

### ML Evaluation

Future models should use temporal and DAO-level holdouts, report false-positive and false-negative rates, compare with transparent baselines, undergo adversarial testing, and retain model and feature versioning.

### Implementation Status

The FlexGov hackathon implementation is built from scratch during the hackathon window. It shares no code with prior work; it is informed by the author's earlier research, which validated the core approach empirically (§5; Pateman-Brown, 2025), and by the design programme in this document.

**Demonstrated in prior research (2025, separate codebase):** bootstrap-validated Isolation Forest anomaly detection on live ENS governance data; deterministic whale-share and duplicate-timestamp signals; tiered rule pivoting; winner-side Gini fairness measurement.

**Built during the hackathon (this submission — updated as the build progresses):**

- on-demand proposal and ballot ingestion from Snapshot Hub;
- a reproducible Compound Governor Bravo proposal-393 report sourced through The Graph on Ethereum mainnet, including 29 indexed ballots, authoritative quorum, lifecycle, contract-action, and source-provenance evidence;
- deterministic signals for top-wallet and top-k share, Gini concentration, minimum wallets controlling half of cast weight, late-cast voting power, and timestamp concentration;
- source-dependent quorum findings, with unavailable fields disclosed rather than estimated;
- counterfactual tallies over the same observed ballots using 1T1V, square-root weighting, 1W1V, and experimental Gini-adaptive dampening;
- `robust`, `contested`, `rule-dependent`, and unavailable outcome classification across that comparison suite;
- canonical machine-readable Governance Health Reports with source, configuration, and report SHA-256 hashes;
- a public React/Next.js interface with pinned reports for six Snapshot communities plus the Compound Graph case study;
- advisory threshold findings, methodology, limitations, data-availability disclosures, and verification metadata.

**Experimental in the submitted MVP:** Gini-adaptive dampening; the reference model used to interpret exact-timestamp concentration; configured threshold findings. These are exposed for inspection rather than presented as proof of wrongdoing or a universally correct rule.

**Narrative case study, not a canonical live integration:** BonkDAO (§6.1) motivates the product and illustrates the missing evidence. The submitted implementation does not claim a live BonkDAO data adapter, late-acquisition reconstruction, or verified alternative outcome.

**Design-only or not connected:** binding Ensemble meta-voting, Flex policy enforcement, ILS Mode, Mixed Strategy Mode, automatic rule replacement, token-acquisition and wallet-funding monitoring, unique-person identity, runtime machine learning or AI interpretation, content-addressed storage, onchain attestation, verifiable compute, and any enforcement authority. These remain subject to the open questions in §12.

## 11. Limitations

- Wallets do not map reliably to people.
- Statistical anomalies do not prove bribery, collusion, or malicious intent.
- Low turnout and concentration can occur for benign reasons.
- Counterfactual rules embody political assumptions rather than neutral truth.
- QV and other transformations require precise resource and identity definitions.
- Adaptive policies may be gamed when triggers are known; evasion imposes real cost, delay, and visibility on the attacker, but deterrence fails wherever the payoff still exceeds the cheapest evasive path.
- Unexpected rule changes may undermine legitimacy.
- Oracles and off-chain calculations introduce trust dependencies.
- Privacy-preserving ballots constrain available detection data.
- ML models may drift, discriminate, or be manipulated.
- FlexGov cannot stop an execution unless it has been granted enforceable authority.
- Mechanisms combined in an Ensemble or Mixed Strategy may share vulnerabilities; a combination built from mechanisms with correlated attack surfaces can be weaker than its strongest member. This applies most strongly to simultaneous Ensemble aggregation; Flex Mode's pivot principle mitigates it, but only as well as the detection layer that drives the pivot.
- Every concentration-dampening tally rule rewards stake-splitting; mechanism selection shifts the attack surface rather than removing it.
- The deterrence thesis is economic and conditional: a sufficiently capitalised attacker facing a sufficiently valuable treasury under a weakly configured policy can still profit. No attack-cost inflation factor has yet been quantified for any policy configuration; until one is, deterrence claims describe design intent rather than measured fact.
- Signals tuned to detect historical attacks may also flag ordinary low-turnout, high-concentration votes; a warning system that alerts routinely will be ignored.
- Proof of personhood can bound the cost of manipulating participation-quality measures, but it cannot establish that the verified human—rather than an assisting AI system—performed the engagement being measured.
- Detection without pre-installed enforcement authority produces a well-documented account of an attack, not an interruption of it.

### Partial Mitigations

Several of these limitations have credible partial mitigations in existing infrastructure. Each reduces or relocates trust; none eliminates the underlying limitation, and each introduces dependencies of its own.

- **Proof of personhood and human-backed agent attestation** (e.g., World ID and AgentKit-style credentials) address the wallet–person gap directly. They enable identity-backed 1P1V as a Flex Mode pivot destination whose attack-cost axis is identity rather than tokens—the anti-correlated attack surface that splitting-based strategies cannot buy—and they convert Sybil manipulation from an unbounded attack into a bounded per-human cost. *Residual:* identity-renting markets reduce that bound; verification establishes that a unique human exists behind a credential, not that the human engaged with the decision or solely controls the agent.
- **TEE-based verifiable compute** (e.g., attested inference environments such as 0G Compute) addresses the oracle and operator-trust dependency. Measurements, counterfactuals, and model inferences can be attested to have been produced by the declared code on the declared inputs, so a community need not trust FlexGov's operator not to manipulate the analysis—a governance-security layer is itself a governance trust point, and attestation closes that loop. *Residual:* trust relocates to the hardware vendor and attestation chain, and attestation proves which model ran, not that the model is well calibrated, unbiased, or correctly thresholded.

These proposed mitigations could strengthen two layers the deterrence thesis depends on—identity cost and analysis integrity. Neither is connected in the submitted MVP, and each remains subject to the dependencies and residual risks described above.

## 12. Open Questions for Community Collaboration

FlexGov is intended as a collaborative venture, not a finished doctrine. Its design principles—community constitutional choice, legibility, and contestability—apply to the framework itself: the definitions, thresholds, and mechanisms proposed here should be examined, challenged, and improved by the communities expected to rely on them. This section records the questions the authors consider unresolved and where outside expertise—from social-choice theorists, mechanism designers, statisticians, security researchers, political philosophers, and practising DAO contributors—would materially change the design. Formal treatments of several of these questions are tracked in [Mathematical_questions.md](./Mathematical_questions.md).

None of these questions undermines the observability core described in §4–§6: indexing governance data, measuring the concentration and timing of participating power, explaining the evidence, and comparing results under disclosed transformations remain useful regardless of how they are resolved. They concern the conditions under which FlexGov's stronger, binding modes could be trusted—consistent with the principle that each step up the escalation ladder carries a heavier burden of proof.

### 12.1 Mechanism Composition and Correlated Vulnerabilities

The security of any mechanism-combining scheme depends on the correlation structure of the component mechanisms' vulnerabilities, and this remains unanalysed. A concrete example: in an Ensemble of 1T1V, QV, and 1W1V under default plurality meta-voting, an attacker who splits holdings across many wallets strengthens their position under **both** QV and 1W1V simultaneously—two of three meta-votes—potentially at lower cost than defeating 1T1V alone. A binding Ensemble could therefore be *weaker* than its strongest member. The open questions: under what conditions is an Ensemble at least as attack-resistant as its most resistant component? How should correlation between mechanism vulnerabilities be defined and measured? Which mechanism sets exhibit genuinely anti-correlated attack surfaces, such that an action improving an attacker's position under one mechanism worsens it under another?

### 12.2 Adversarial Behaviour Under Known Triggers

Pre-authorised policies publish their triggers, and rational adversaries will optimise against them. An attacker may remain deliberately below a whale-share threshold while splitting into positions that also prevail under the replacement rule, or may intentionally trip a trigger to force a switch to a mechanism they prefer. Whether a switching policy can be made no worse than its default rule against a strategic adversary—and what hysteresis, randomisation, or evidence requirements that demands—is unresolved. The evaluative frame, however, is deterrence rather than invulnerability: evasion behaviours themselves impose cost, delay, and visibility on the attacker, and the policy succeeds when the cheapest attack that defeats every layer costs more than the payoff it seeks. Estimating that attack-cost inflation for candidate policies is an open quantitative task tracked in [Mathematical_questions.md](./Mathematical_questions.md).

### 12.3 Calibration and Base Rates

Ordinary DAO governance is frequently low-turnout and highly concentrated; by published participation statistics, the median legitimate proposal may statistically resemble an attack. If warnings are routine, they will be ignored, and the observability layer fails operationally even where it is technically correct. FlexGov needs empirical calibration work across historical proposals: which measurable properties actually separate attack signatures from ordinary participation, whether thresholds must be DAO-relative rather than global, and what false-positive budget keeps a warning credible. The authors regard this as the single most important empirical question for the project.

### 12.4 Participation Quality in an AI-Saturated Environment

ILS proposes to measure evidence of informed engagement, but contemporary AI systems can pass knowledge checks, produce substantive-seeming deliberative contributions, and simulate reflection at negligible cost. Proof of personhood bounds this manipulation to a per-human cost, but cannot establish that the verified human, rather than an assisting system, performed the engagement; identity-renting markets further reduce that bound. Where participation by human-backed AI agents is itself legitimate, engagement metrics may cease to discriminate at all. What, if anything, an information score can validly measure in this environment—and whether "bounded human commitment" is a sufficient substitute for "verified comprehension"—is an open question that ILS must answer before it can carry weight.

### 12.5 Fallback and Tie-Breaking Authority

An Ensemble tie hands control to a configured fallback mode. The fallback therefore decides precisely the contested cases—those in which the community's authorised mechanisms disagree—making it the highest-stakes configuration choice in the system while appearing to be a technical detail. How communities should reason about fallback selection, and whether the fallback deserves stronger adoption requirements than other parameters, is undecided.

### 12.6 Adoption and the Political Economy of Enforcement

Advisory analysis is permissionless: anyone may run it against public governance data. Binding policies require approval through the very governance processes—and often by the very concentrated actors—that the policies would scrutinise. Historical precedent suggests safeguard adoption is incident-driven rather than anticipatory. The open questions are practical as much as technical: which adoption paths are realistic; whether counterfactual visibility alone measurably changes participant behaviour before any enforcement exists; and what obligations an observability tool has to communities during the period when it can document attacks but not interrupt them.

Contributions on any of these questions—counterexamples, formal results, datasets, adversarial analyses, or disagreement with the framing itself—are invited through the project's open repository and the accompanying [Mathematical_questions.md](./Mathematical_questions.md).

## 13. Future Work

Planned research includes:

- a complete voting-method detection matrix;
- formal outcome-robustness definitions;
- adversarial analysis of pre-authorised switching;
- machine-learning anomaly detection;
- privacy-preserving integrity measurement;
- ILS and deliberative-participation mechanisms;
- QOC proposal-quality evaluation;
- optional human-backed agent credentials;
- historical futarchy simulation;
- expanded monitoring across multiple DAOs.

ILS must not equate time-on-page with informed participation. Candidate evidence may include knowledge checks, substantive deliberative contributions, exposure to competing evidence, and revision after reflection. Each remains imperfect, gameable, and potentially exclusionary, so ILS requires its own empirical and ethical evaluation.

Mixed Strategy Mode remains a future research question. Verifiable randomness can prove that a selection was random, but it cannot establish that stochastic rule selection is legitimate or attack-resistant.

See [future_work_ignore.md](./future_work_ignore.md) for the extended roadmap.

## 14. References

Behnke, R. (2026). “Explained: The BonkDAO Hack (July 2026).” *Halborn*, 13 July. Available at: <https://www.halborn.com/blog/post/explained-the-bonkdao-hack-july-2026> (Accessed: 24 July 2026).

CoinDesk (2022). “Attacker Drains $182M From Beanstalk Stablecoin Protocol.” 17 April. Available at: <https://www.coindesk.com/tech/2022/04/17/attacker-drains-182m-from-beanstalk-stablecoin-protocol/> (Accessed: 24 July 2026).

Condorcet, M.J.A.N. (1785). *Essay on the Application of Analysis to the Probability of Majority Decisions*. Paris: L'Imprimerie Royale.

Dryzek, J.S. (2000). *Deliberative Democracy and Beyond: Liberals, Critics, Contestations*. Oxford University Press. DOI: <https://doi.org/10.1093/019925043X.001.0001>.

Fritsch, R., Müller, M. and Wattenhofer, R. (2024). “Analyzing Voting Power in Decentralized Governance: Who Controls DAOs?” *Blockchain: Research and Applications*, 5(3), 100208. DOI: <https://doi.org/10.1016/j.bcra.2024.100208>.

Gabriel, I. (2020). “Artificial Intelligence, Values, and Alignment.” *Minds and Machines*, 30(3), pp. 411–437. DOI: <https://doi.org/10.1007/s11023-020-09539-2>.

Liu, F.T., Ting, K.M. and Zhou, Z.-H. (2008). “Isolation Forest.” *2008 Eighth IEEE International Conference on Data Mining*, pp. 413–422. DOI: <https://doi.org/10.1109/ICDM.2008.17>.

Malwa, S. (2026). “BONK Faces $20 Million Treasury Drain After Attacker Spends $4 Million to Pass Malicious Proposal.” *CoinDesk*, 7 July. Available at: <https://www.coindesk.com/markets/2026/07/07/bonk-faces-usd20-million-treasury-drain-after-attacker-spends-usd4-million-to-pass-malicious-proposal> (Accessed: 24 July 2026).

Matthews, P. (2015). *Social Epistemology and Online Knowledge Exchange*. DPhil thesis, University of the West of England, Bristol. Available at: <https://uwe-repository.worktribe.com/output/802272> (Accessed: 24 July 2026).

Mohsin, F., Liu, A., Chen, P.-Y., Rossi, F. and Xia, L. (2022). “Learning to Design Fair and Private Voting Rules.” *Journal of Artificial Intelligence Research*, 75, pp. 1139–1176.

Ostrom, E. (1990). *Governing the Commons: The Evolution of Institutions for Collective Action*. Cambridge University Press. DOI: <https://doi.org/10.1017/CBO9780511807763>.

Pateman-Brown, A. (2025). *FlexGov — Learning to Govern: Measuring, Modelling, and Reimagining Fairness in DAO Voting*. MSc coursework (Machine Learning and Predictive Analytics), University of the West of England, Bristol.

Russell, S.J. (2019). *Human Compatible: Artificial Intelligence and the Problem of Control*. New York: Viking.

U.S. Securities and Exchange Commission (2023). “SEC Charges Avraham Eisenberg with Manipulating Mango Markets' ‘Governance Token’ to Steal $116 Million of Crypto Assets.” 20 January. Available at: <https://www.sec.gov/newsroom/press-releases/2023-13> (Accessed: 24 July 2026).

Weyl, E.G., Tang, A. and Plurality Community (2024). *Plurality: The Future of Collaborative Technology and Democracy*. Available at: <https://plurality.net/read/>; see also “What is ⿻?” <https://plurality.net/read/3-0/> and “⿻ Voting” <https://plurality.net/read/5-6/> (Accessed: 24 July 2026).
