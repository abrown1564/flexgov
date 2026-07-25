# FlexGov Mathematical Questions

> **Status:** Open design and research questions  
> **Purpose:** Record mathematical decisions that must be resolved before FlexGov metrics or modes are treated as binding governance rules.

## 1. Ensemble Mode: Meta-Voting Across Mechanisms

Ensemble Mode runs the DAO's selected voting mechanisms in parallel. Each mechanism resolves the underlying proposal to one categorical output drawn from the same choice set. The ensemble then treats those mechanism outputs as meta-votes.

For example:

| Mechanism | Categorical output |
|---|---|
| A | Result 1 |
| B | Result 3 |
| C | Result 1 |
| D | Result 2 |
| E | Result 1 |
| F | Result 1 |

With equal mechanism weights, Result 1 receives four meta-votes and becomes the Ensemble output.

By default under the FlexGov ruleset:

- each eligible mechanism receives one equal meta-vote;
- a plurality is sufficient to select the Ensemble output;
- the DAO may configure a higher winning threshold;
- the DAO may assign different mechanism weights in advance;
- a mechanism that fails quorum or returns an indeterminate result is labelled accordingly rather than silently converted into a vote;
- a tie produces no Ensemble decision and hands control to the DAO's configured fallback mode.

This aggregation operates on categorical mechanism outputs—not on incomparable raw vote totals. FlexGov should still display each underlying result and report how much agreement exists behind the Ensemble output.

### Proposed Robustness Classification

For analysis, a binary proposal may also give each mechanism a normalised margin:

```text
m_r = (support_r - oppose_r) / (support_r + oppose_r)
```

where `r` is the voting rule and `m_r` lies between `-1` and `1`. Quorum should be reported separately rather than folded silently into the margin.

FlexGov can classify the degree of mechanism agreement as:

| Classification | Proposed meaning |
|---|---|
| Unanimous across mechanisms | Every evaluated mechanism produces the same pass/fail result and satisfies its stated quorum rule |
| Directionally consistent | Every mechanism points in the same direction, but strength of support or quorum treatment differs materially |
| Mechanism-sensitive | The result, quorum status, or confidence changes materially under at least one plausible mechanism |
| Outcome reversal | At least one plausible mechanism passes the proposal and another rejects it |
| Indeterminate | Missing identity, eligibility, delegation, snapshot, or other data prevents a defensible comparison |

The thresholds separating “directionally consistent” from “mechanism-sensitive” remain an open design choice.

### Open Questions

- How should the DAO set a winning threshold above the default plurality?
- What fallback mode should receive control after a tie or failure to reach the configured threshold?
- Should closely related mechanisms count independently, or should mechanism families share a capped or collective meta-weight?
- How should similarity between mechanisms be defined without embedding contested political judgments?
- How are multi-option, ranked, and approval outputs mapped onto a common categorical choice set?
- How should abstention be represented at the mechanism and meta-vote levels?
- When a mechanism fails quorum or returns indeterminate, should its weight be removed from the denominator or retained when calculating the winning threshold?
- What does a non-equal mechanism weight represent: community preference, historical reliability, attack resistance, or contextual suitability?
- Which governance process may set and change mechanism weights?
- How far in advance must weights, thresholds, and fallback modes be fixed?
- Can a mechanism be excluded when its identity, eligibility, or data assumptions are unsupported?

### Correlated Attack Surfaces

The security of the Ensemble depends on the correlation structure of its component mechanisms' vulnerabilities, not only on their individual strength. Worked example: with the default set {1T1V, QV, 1W1V} and equal plurality meta-voting, wallet splitting improves the attacker's position under **both** QV and 1W1V—two of three meta-votes—potentially at lower cost than acquiring a 1T1V majority. A binding Ensemble can therefore be strictly weaker than its strongest member.

- Under what formal conditions is an Ensemble at least as attack-resistant as its most resistant component mechanism?
- How should correlation between mechanism vulnerabilities be defined and measured (e.g., a common action, such as Sybil splitting, that simultaneously improves the attacker's position under multiple mechanisms)?
- Which mechanism sets have demonstrably anti-correlated attack surfaces, such that an action improving an attacker's meta-vote position under one mechanism worsens it under another?
- For a candidate mechanism set, what is the minimum attacker budget to win a plurality of meta-votes, and how does it compare with the budget required to defeat each mechanism alone?
- Should FlexGov require, or merely recommend, a vulnerability-correlation analysis before a DAO authorises a binding Ensemble?

## 2. Pre-Authorised Rule Replacement

FlexGov should not unexpectedly replace a voting rule after participants have voted. However, a DAO may deliberately adopt an adaptive constitution in advance. Under that model, rule replacement is legitimate because the triggers, candidate rules, data requirements, and consequences are agreed before the proposal opens.

### Required Policy Components

A binding adaptive policy should specify:

1. the eligible voting mechanisms;
2. the observable trigger variables;
3. trigger thresholds and measurement windows;
4. the snapshot used for balances and eligibility;
5. whether the response is a pause, review, recount, rerun, or automatic replacement;
6. how votes are transformed or recollected under the replacement rule;
7. quorum and abstention treatment;
8. appeal, veto, emergency, and timelock procedures;
9. who may amend the policy;
10. how policy changes are announced before they take effect.

### Open Mathematical Questions

- Is the replacement rule selected directly from a threshold table or by an integrity function?
- Can the same observations both select and score a rule without introducing circularity?
- How can an attacker manipulate a trigger to force a more favourable mechanism?
- How should thresholds account for "threshold shadowing," where an attacker deliberately remains just below a trigger while building a position that also prevails under the replacement rule?
- Can a switching policy be shown to be no worse than its default rule against a strategic adversary who knows the policy, and what hysteresis, randomisation, or evidence requirements does that demand?
- Must all alternative ballots be collected simultaneously, or can existing ballots be transformed?
- Under what conditions is ballot transformation valid?
- How should the system handle strategic voting when participants know the switching policy?
- Real policies must be defined over signal **combinations**, not single signals: a first-match if/elif chain imposes an implicit priority order, and the canonical adversary (a split whale) fires splitting signals while remaining below concentration thresholds. What is the right formal object—a decision table over the signal lattice, with ambiguous or conflicting regions mapped to escalation rather than automatic pivots?
- Does every row of a candidate policy table satisfy the selection invariant (the selected rule must make the detected behaviour worthless), and can that property be checked mechanically for a configured policy?
- How much hysteresis is required to prevent rapid oscillation between rules?
- Should a trigger be based on a point estimate, confidence interval, or posterior probability?
- What minimum evidence is required before an automatic response is allowed?

## 3. Integrity Metrics

An overall integrity score must remain decomposable. The underlying signals represent different phenomena and should not be treated as interchangeable evidence of misconduct.

### Candidate Signal Families

- voting-power concentration;
- top-wallet and top-k shares;
- Gini coefficient;
- Nakamoto-style minimum coalition size;
- turnout and quorum margin;
- late voting-power acquisition;
- voting-time concentration;
- wallet age and funding provenance;
- delegation concentration;
- correlated choices and transaction timing;
- outcome sensitivity across governance rules;
- machine-learning anomaly scores.

### Questions

- Which signals are descriptive, and which justify an intervention?
- How are features scaled without hiding their original meaning?
- Should thresholds be absolute, DAO-relative, or learned from historical behaviour?
- How are small DAOs treated when ordinary participation naturally resembles a cluster?
- How are uncertainty and incomplete data presented?
- Can one severe signal override several benign signals?
- Should an overall score be additive, multiplicative, rule-based, Bayesian, or learned?
- How are false positives and false negatives valued for different proposal types?
- How are proposal value and reversibility incorporated into escalation thresholds?
- What are the empirical base rates? Ordinary DAO participation is frequently low-turnout and highly concentrated, so the median legitimate proposal may statistically resemble an attack. Which measurable properties actually separate attack signatures from routine votes on historical data?
- What false-positive budget keeps a warning credible in operation, and how should thresholds be tuned to stay within it without missing true attacks?
- Should calibration be performed per DAO, per DAO-size class, or globally, and how much history does each approach require?

## 4. Machine-Learning Anomaly Detection

Machine learning is expected to become important when FlexGov models the interactions among voting mode, vulnerability, and observable behaviour. It remains in scope.

For the MVP, deterministic measurements should lead because they are easy to audit and explain. An Isolation Forest or other anomaly detector may appear as an additional experimental signal, clearly separated from the deterministic findings.

### Research Questions

- What constitutes the training population: votes, wallets, proposals, DAOs, or time windows?
- Is a global model meaningful across DAOs with different participation patterns?
- How much clean historical data exists?
- How are labels obtained when manipulation is rarely proven?
- Should the system use unsupervised, semi-supervised, or supervised learning?
- Which features create identity or wealth proxies?
- How are concept drift and governance-policy changes detected?
- How can explanations identify the features responsible for an anomaly?
- What adversarial strategies can evade or poison the model?
- How should model output affect a pre-authorised governance policy?
- What benchmark should ML beat beyond transparent thresholds?

### Evaluation Requirements

- temporal, DAO-level holdout evaluation rather than random vote splitting;
- explicit false-positive and false-negative reporting;
- comparison against simple deterministic baselines;
- ablation studies for each feature family;
- stability testing across parameter choices;
- adversarial and data-poisoning tests;
- calibration where the model emits probabilities;
- reproducible model, feature, and dataset versions;
- human review of disputed flags.

## 5. Detection Matrix Still Required

A complete design matrix must be produced for every voting method:

```text
voting method
→ vulnerability
→ observable signal
→ data required
→ calculation
→ threshold or statistical test
→ confidence/uncertainty
→ response
→ implementation complexity
→ MVP or future-work status
```

Each material vulnerability should have at least two or three candidate detection methods. The matrix must distinguish:

- detecting vulnerability conditions;
- detecting suspicious behaviour;
- attributing malicious intent;
- preventing or interrupting execution.

FlexGov should normally claim the first two. It should claim prevention only where a DAO has installed and authorised an enforceable response.

## 6. Mixed Strategy Mode

Mixed Strategy Mode selects one governing mechanism from an authorised probability distribution using verifiable randomness. Its claimed benefit is strategic unpredictability, but this benefit is conditional and unproven.

### Core Question: When Does Randomisation Raise Attack Cost?

Against an attacker who knows the distribution and optimises expected payoff, randomisation raises attack cost only where the eligible mechanisms require **conflicting** attack strategies. If one action (e.g., Sybil splitting) improves the attacker's position under most of the probability mass, the random draw adds complexity without security. The viability criterion for Mixed Strategy Mode is therefore the same anti-correlation property identified for Ensemble Mode, and the two analyses should share a common formal framework.

### Open Questions

- For a given mechanism set and distribution, what is the attacker's optimal expected-payoff strategy, and how does its cost compare with attacking the best single fixed rule?
- How is "conflicting attack strategies" formally defined, and can conflict be measured from the same vulnerability-correlation analysis required for Ensemble composition?
- How does the timing of mechanism selection and reveal interact with ballot comparability—must every ballot be interpretable under every eligible mechanism, and what does that constraint exclude?
- Can community-defined suitability scores (`score_r`) be manipulated to shift the distribution toward an attacker-preferred mechanism?
- How should the temperature or dispersion parameter be chosen, and what does the choice trade off between unpredictability and mechanism suitability?
- What happens to committed ballots if the randomness source fails or is manipulated?
- Is there empirical or game-theoretic evidence that stochastic rule selection outperforms deterministic Flex Mode responses at equal complexity?

## 7. Information Level Score (ILS)

ILS proposes a weighted score over evidence of informed engagement (`ILS_i = w_k K_i + w_e E_i + w_d D_i + w_r R_i`). Its central mathematical and measurement questions are unresolved.

### Open Questions

- What can each component (`K`, `E`, `D`, `R`) validly measure when contemporary AI systems can pass knowledge checks, generate substantive-seeming contributions, and simulate reflection at negligible cost?
- Proof of personhood bounds manipulation to a per-human cost but cannot verify that the human performed the engagement. How should that bound be modelled, and how do identity-renting markets reduce it?
- If participation by human-backed AI agents is legitimate, every agent can maximise engagement metrics; ILS then ceases to discriminate and collapses toward 1P1V. Is there any component that remains informative in that regime?
- What bounds on the transformation from ILS to effective ballot weight prevent the score from creating a credentialed elite while still carrying information?
- How should component scores be normalised across proposals of different complexity, and how is inter-rater or inter-model reliability established for components requiring judgment?
- Which component definitions and weights create social, educational, linguistic, or accessibility proxies, and how is that tested?
- Can ILS be audited for content-neutrality—rewarding engagement rather than agreement—and what statistical test would detect a violation?

## 8. Gini-Normalised Tally Rules

The hackathon plan references a "Gini-normalised" counterfactual, and Flex Mode proposes concentration-dampening rules as the pivot target for detected whale dominance. The transformation is currently undefined and must be specified before use.

### Candidate Definitions

- **Per-wallet share cap:** each wallet's effective weight is `min(w_i, c · W_total)` for a configured cap fraction `c`, with or without redistribution of the excess.
- **Concave exponent:** effective weight `w_i^α` for `α ∈ (0, 1]`, where `α = 1` recovers 1T1V and `α = 0.5` recovers QV-style dampening.
- **Target-concentration rescaling:** an iterative transformation chosen so the post-transform distribution meets a community-selected winner-side Gini target `G*`.

### Splitting-Neutrality Proposition

A per-wallet tally transformation `f` is splitting-neutral if and only if it is linear: `f(a + b) = f(a) + f(b)`. Any strictly concave `f` (all dampening rules above, plus QV and 1W1V as the limiting case) strictly rewards dividing a stake across wallets; any strictly convex `f` would reward merging. Plain 1T1V is therefore the unique splitting-neutral rule, and it is splitting-neutral precisely because it dampens nothing. This proposition should be stated and proved formally, since it constrains the entire mechanism-design space: concentration-dampening and splitting-incentives are the same lever.

### Open Questions

- Which transformation family should FlexGov support, and should the choice be per-DAO, per-proposal-class, or fixed?
- Should concentration be measured over cast votes or over the eligible snapshot population, and how does each choice behave under low turnout?
- A per-wallet cap limits individual shares but not coalition shares: 200 wallets under the cap can still jointly dominate. What complementary coalition-level measure (e.g., top-k share, Nakamoto coalition size) must accompany the transformation?
- How does adding a Gini-normed mechanism to an Ensemble change the vulnerability-correlation analysis in §1 (it adds a further splitting-rewarding meta-vote)?
- As a Flex Mode pivot target, under exactly which detected conditions is Gini-normed 1T1V the correct destination, and under which (high splitting signals) is a linear or review response required instead?
- How should the transformation parameters (`c`, `α`, `G*`) be selected, and can they be tuned adversarially by whoever proposes them?

## 9. Deterrence Economics and Attack-Cost Inflation

FlexGov's security thesis is economic deterrence: an attack is prevented when its expected cost exceeds its expected payoff. This is quantifiable and should be quantified.

### Proposed Measure

Define the **attack-cost inflation factor** of a policy `P` for a target treasury action of value `V`:

```text
ACI(P) = C_min(P) / C_min(no policy)
```

where `C_min` is the cheapest attack path that defeats every layer (acquisition cost, capital lock-up, market impact, gas, coordination, plus cost weighted by probability of detection, escalation, and clawback). The policy succeeds when expected cost exceeds expected payoff: `E[C_min(P)] > p_success · V`. Baseline reference: the BonkDAO attack had a cost-to-payoff ratio of roughly 0.22 ($4.4M against $20M).

### Open Questions

- How is `C_min` computed for a given policy—what is the attacker's optimisation problem over acquisition strategy, wallet structure, funding provenance, and timing, given published detection thresholds?
- How are capital lock-up duration, market impact of accumulation, failure probability at each escalation rung, and post-execution recovery probability priced into the cost model?
- How does trigger uncertainty (recalibrated thresholds, Mixed Strategy selection) change the attacker's expected-utility calculation, and how risk-averse should the attacker be assumed to be?
- Which policy parameters raise ACI most per unit of added false-positive burden on legitimate participants?
- Can ACI be estimated and reported per proposal as a live product metric—e.g., "this treasury action is deterrence-covered at current policy settings"—and what data would that require?
- What is the demonstrable ACI for the BonkDAO scenario under a specified FlexGov policy? Producing this number is likely the single most persuasive empirical output the project can generate.

## 10. Later Questions

- How should ranked, approval, conviction, liquid-democracy, sortition, and multi-option outcomes be compared?
- Can robustness be measured without assuming one mechanism is the ground truth?
- How should delegation chains and circular delegations be represented?
- How should private ballots be analysed without weakening ballot secrecy?
- What privacy-preserving aggregates are sufficient for integrity analysis?
- Can a governance rule be strategy-proof under known adaptive triggers?
- How should mechanism risk be combined with smart-contract, oracle, and execution risk?
- What empirical evidence would justify moving from advisory output to binding selection?
