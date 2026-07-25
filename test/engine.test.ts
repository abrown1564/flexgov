import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  choiceKey,
  createEngine,
  gini,
  replay,
  buildReport,
  type ProposalContext,
  type VoteEvent,
} from "../src/index.js";

const here = dirname(fileURLToPath(import.meta.url));

describe("signals", () => {
  it("gini is 0 for equal weights and high for extreme concentration", () => {
    expect(gini([100, 100, 100, 100])).toBeCloseTo(0, 6);
    expect(gini([1_000_000, 1, 1, 1, 1, 1, 1])).toBeGreaterThan(0.8);
    expect(gini([])).toBe(0);
  });
});

describe("choiceKey", () => {
  it("treats approval sets as order-insensitive", () => {
    expect(choiceKey(["A", "B"], { voteTypeHint: "approval" })).toBe(
      choiceKey(["B", "A"], { voteTypeHint: "approval" }),
    );
  });
  it("treats ranked ballots as order-sensitive", () => {
    expect(choiceKey([1, 2, 3])).not.toBe(choiceKey([3, 2, 1]));
  });
  it("buckets weighted ballots by tolerance", () => {
    expect(choiceKey({ A: 0.51, B: 0.49 })).toBe(choiceKey({ A: 0.52, B: 0.48 }));
    expect(choiceKey({ A: 0.9, B: 0.1 })).not.toBe(choiceKey({ A: 0.5, B: 0.5 }));
  });
});

describe("BonkDAO-shaped replay (BIP #76 placeholder fixture)", () => {
  const fixture = JSON.parse(
    readFileSync(join(here, "../data/bip76.placeholder.json"), "utf8"),
  ) as { proposal: ProposalContext; events: VoteEvent[] };

  const frames = replay(fixture.proposal, fixture.events);
  const final = frames[frames.length - 1]!;

  it("produces one frame per vote", () => {
    expect(frames).toHaveLength(7);
  });

  it("fires extreme whale alert on the attacker's vote", () => {
    const whale = final.alerts.find((a) => a.id === "whale:extreme");
    expect(whale).toBeDefined();
    expect(whale!.voteIndex).toBe(1);
    expect(final.signals.whaleShare).toBeGreaterThan(0.99);
  });

  it("flags quorum met by catastrophically low turnout", () => {
    expect(final.alerts.some((a) => a.id === "quorum:met")).toBe(true);
    const turnout = final.alerts.find((a) => a.id === "turnout:critical");
    expect(turnout).toBeDefined();
    expect(final.signals.turnout).toBeLessThan(0.001);
  });

  it("1W1V counterfactual flips the outcome", () => {
    const actual = final.outcomes.find((o) => o.rule === "1T1V")!;
    const oneWallet = final.outcomes.find((o) => o.rule === "1W1V")!;
    expect(actual.winner).toBe("For");
    expect(oneWallet.winner).toBe("Against");
  });

  it("classifies the token-weighted outcome as rule-dependent", () => {
    expect(final.robustness).toBe("rule-dependent");
  });

  it("tiered rule selection recommends 1W1V against whale dominance", () => {
    expect(final.recommendedRule).toBe("1W1V");
    expect(frames[0]!.recommendedRule).toBe("1W1V"); // from the attacker's vote
  });

  it("reports concentration stats: one wallet controls 50%+, per-rule Gini", () => {
    expect(final.signals.walletsFor50Pct).toBe(1);
    const oneWallet = final.outcomes.find((o) => o.rule === "1W1V")!;
    const actual = final.outcomes.find((o) => o.rule === "1T1V")!;
    expect(oneWallet.gini).toBeCloseTo(0, 6);
    expect(actual.gini).toBeGreaterThan(0.8);
  });

  it("escalates early — days before the voting window closes", () => {
    expect(final.escalated).toBe(true);
    const esc = final.alerts.find((a) => a.id === "policy:escalation")!;
    expect(esc.voteIndex).toBeLessThanOrEqual(2);
    // fired more than 4 days before proposal end
    expect(fixture.proposal.end - esc.at).toBeGreaterThan(4 * 86400);
  });

  it("renders an advisory report without prevention claims", () => {
    const report = buildReport(final);
    expect(report).toContain("Counterfactual outcomes");
    expect(report).toContain("rule-dependent");
    expect(report.toLowerCase()).not.toContain("prevented");
  });
});

describe("sybil detection", () => {
  const proposal: ProposalContext = {
    id: "sybil-test",
    start: 0,
    end: 100000,
  };

  it("flags a tight burst of similar wallets and fires only once", () => {
    const engine = createEngine(proposal);
    const events: VoteEvent[] = [
      { voter: "a", weight: 100, choice: "For", timestamp: 1000 },
      { voter: "b", weight: 100, choice: "For", timestamp: 1004 },
      { voter: "c", weight: 100, choice: "For", timestamp: 1008 },
      { voter: "d", weight: 100, choice: "For", timestamp: 1012 },
    ];
    let last = events.map((e) => engine.ingest(e)).at(-1)!;
    const sybilAlerts = last.alerts.filter((a) => a.signal === "sybil");
    expect(sybilAlerts).toHaveLength(1);
    expect(sybilAlerts[0]!.severity).toBe("extreme");
    // tier 2: sybil evidence (no whale dominance) -> QV recount
    expect(last.recommendedRule).toBe("QV");
  });

  it("does not flag organic, spread-out voting", () => {
    const engine = createEngine(proposal);
    const events: VoteEvent[] = [
      { voter: "a", weight: 137.2, choice: "For", timestamp: 1000 },
      { voter: "b", weight: 22.9, choice: "Against", timestamp: 5000 },
      { voter: "c", weight: 954.1, choice: "For", timestamp: 9000 },
    ];
    const last = events.map((e) => engine.ingest(e)).at(-1)!;
    expect(last.alerts.filter((a) => a.signal === "sybil")).toHaveLength(0);
  });
});

describe("collusion detection", () => {
  it("flags identical ranked ballots deliberately spread out (rainbow pattern)", () => {
    const engine = createEngine({ id: "collusion-test", start: 0, end: 100000 });
    const events: VoteEvent[] = [
      { voter: "a", weight: 500, choice: [1, 2, 3], timestamp: 1000 },
      { voter: "b", weight: 480, choice: [1, 2, 3], timestamp: 1150 },
      { voter: "c", weight: 510, choice: [1, 2, 3], timestamp: 1250 },
    ];
    const last = events.map((e) => engine.ingest(e)).at(-1)!;
    const collusion = last.alerts.filter((a) => a.signal === "collusion");
    expect(collusion).toHaveLength(1);
    expect(collusion[0]!.severity).toBe("strong");
    expect(collusion[0]!.message).toContain("evasion");
  });
});
