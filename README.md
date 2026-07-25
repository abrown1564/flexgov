# @flexgov/engine

Stream-shaped governance security engine. Ingests governance vote events one at a
time and emits, per event: detection signals, alerts, counterfactual outcomes
under alternative voting rules, and an advisory robustness classification.

Built from scratch at ETHGlobal Lisbon, July 2026, based on the FlexGov research
programme (whitepaper + 2025 coursework). Advisory by default; enforcement only
via pre-authorised policy.

- Zero runtime dependencies — runs in Node and in the browser (Replay Player).
- One code path for both modes: **Replay** (recorded event stream) and
  **Live** (subgraph-fed event stream).
