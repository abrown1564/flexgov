import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  choiceKey,
  createEngine,
  duplicateTimestampSensitivity,
  expectedDuplicateTimestampRatio,
  gini,
  replay,
  analyze,
  buildReport,
  VULNERABILITY_MATRIX,
  detectorApplies,
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

  it("computes the neutral exact-second collision baseline", () => {
    const expected = expectedDuplicateTimestampRatio(62_245, 6 * 86_400);
    expect(expected).not.toBeNull();
    expect(expected!).toBeCloseTo(0.1132, 3);
  });

  it("shows how the baseline changes under narrower daily activity windows", () => {
    const scenarios = duplicateTimestampSensitivity(
      62_245,
      6 * 86_400,
    );
    expect(scenarios.map((s) => s.activeHoursPerDay)).toEqual([24, 16, 12, 8]);
    expect(scenarios[0]!.expectedRatio).toBeCloseTo(0.1131, 3);
    expect(scenarios[1]!.expectedRatio).toBeCloseTo(0.1647, 3);
    expect(scenarios[2]!.expectedRatio).toBeCloseTo(0.2134, 3);
    expect(scenarios[3]!.expectedRatio).toBeCloseTo(0.3023, 3);
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

  it("1W1V counterfactual weighs every wallet equally (mechanics only)", () => {
    // NOTE: how the 6 non-attacker wallets actually voted on BIP #76 is NOT
    // yet verified — the fixture's choices are placeholders. No winner-flip
    // claim is asserted here until the real reconstruction lands.
    const oneWallet = final.outcomes.find((o) => o.rule === "1W1V")!;
    const totalBallots = Object.values(oneWallet.tally).reduce(
      (a, b) => a + b,
      0,
    );
    expect(totalBallots).toBe(7);
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

  it("renders an advisory report without prevention claims", () => {
    const report = buildReport(final);
    expect(report).toContain("Counterfactual outcomes");
    expect(report.toLowerCase()).not.toContain("prevented");
  });
});

describe("synthetic whale-capture scenario (engine mechanics, not BIP #76 claims)", () => {
  // Deliberately synthetic: one dominant wallet For, majority of small
  // wallets Against. Verifies flip/robustness/escalation MECHANICS without
  // asserting anything about the real BonkDAO ballot contents.
  const proposal: ProposalContext = {
    id: "synthetic-capture",
    start: 1_000_000_000,
    end: 1_000_518_400,
    memberCount: 18_000,
    totalSupply: 100_000_000,
    quorumFraction: 0.01,
  };
  const events: VoteEvent[] = [
    { voter: "whale", weight: 1_005_000, choice: "For", timestamp: 1_000_003_600 },
    { voter: "w2", weight: 205, choice: "Against", timestamp: 1_000_090_000 },
    { voter: "w3", weight: 205, choice: "Against", timestamp: 1_000_176_400 },
    { voter: "w4", weight: 205, choice: "For", timestamp: 1_000_262_800 },
    { voter: "w5", weight: 205, choice: "Against", timestamp: 1_000_349_200 },
    { voter: "w6", weight: 205, choice: "Against", timestamp: 1_000_435_600 },
    { voter: "w7", weight: 205, choice: "Against", timestamp: 1_000_500_000 },
  ];
  const frames = replay(proposal, events);
  const final = frames[frames.length - 1]!;

  it("1W1V flips the winner when small wallets oppose the whale", () => {
    expect(final.outcomes.find((o) => o.rule === "1T1V")!.winner).toBe("For");
    expect(final.outcomes.find((o) => o.rule === "1W1V")!.winner).toBe(
      "Against",
    );
  });

  it("classifies the token-weighted outcome as rule-dependent", () => {
    expect(final.robustness).toBe("rule-dependent");
  });

  it("escalates days before the voting window closes", () => {
    expect(final.escalated).toBe(true);
    const esc = final.alerts.find((a) => a.id === "policy:escalation")!;
    expect(esc.voteIndex).toBeLessThanOrEqual(2);
    expect(proposal.end - esc.at).toBeGreaterThan(4 * 86400);
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

  it("surfaces timestamp collisions without selecting QV on that signal alone", () => {
    const events: VoteEvent[] = [
      { voter: "a", weight: 10, choice: "For", timestamp: 1000 },
      { voter: "b", weight: 10, choice: "Against", timestamp: 1000 },
      { voter: "c", weight: 10, choice: "For", timestamp: 5000 },
      { voter: "d", weight: 10, choice: "Against", timestamp: 9000 },
    ];
    const last = replay(proposal, events).at(-1)!;
    expect(last.signals.dupTimestampRatio).toBe(0.5);
    expect(last.signals.expectedDupTimestampRatio).not.toBeNull();
    expect(last.recommendedRule).toBe("1T1V");
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

describe("voting-type awareness (vulnerability matrix)", () => {
  const burst = (): VoteEvent[] => [
    { voter: "a", weight: 500, choice: "For", timestamp: 1000 },
    { voter: "b", weight: 480, choice: "For", timestamp: 1150 },
    { voter: "c", weight: 510, choice: "For", timestamp: 1250 },
  ];

  it("does NOT fire collusion for single-choice (identical votes are normal)", () => {
    const last = replay(
      { id: "sc", start: 0, end: 100000, voteType: "single" },
      burst(),
    ).at(-1)!;
    expect(last.alerts.filter((a) => a.signal === "collusion")).toHaveLength(0);
  });

  it("does NOT fire collusion for basic (For/Against/Abstain)", () => {
    const last = replay(
      { id: "b", start: 0, end: 100000, voteType: "basic" },
      burst(),
    ).at(-1)!;
    expect(last.alerts.filter((a) => a.signal === "collusion")).toHaveLength(0);
  });

  it("DOES fire collusion for approval (identical approval sets are suspicious)", () => {
    const events: VoteEvent[] = [
      { voter: "a", weight: 500, choice: ["1", "3"], timestamp: 1000 },
      { voter: "b", weight: 480, choice: ["3", "1"], timestamp: 1150 },
      { voter: "c", weight: 510, choice: ["1", "3"], timestamp: 1250 },
    ];
    const last = replay(
      { id: "ap", start: 0, end: 100000, voteType: "approval" },
      events,
    ).at(-1)!;
    expect(
      last.alerts.filter((a) => a.signal === "collusion").length,
    ).toBeGreaterThan(0);
  });

  it("matrix has 2-3 rows per voting type and gates collusion correctly", () => {
    for (const rows of Object.values(VULNERABILITY_MATRIX)) {
      expect(rows.length).toBeGreaterThanOrEqual(2);
      expect(rows.length).toBeLessThanOrEqual(3);
    }
    expect(detectorApplies("single", "collusion")).toBe(false);
    expect(detectorApplies("basic", "collusion")).toBe(false);
    expect(detectorApplies("approval", "collusion")).toBe(true);
    expect(detectorApplies("ranked", "collusion")).toBe(true);
  });
});

describe("late-influence signal", () => {
  it("fires when a large share of weight arrives in the final window slice", () => {
    // Window [0, 1000]; final 10% is (900, 1000]. Two big late votes = ~90% late.
    const events: VoteEvent[] = [
      { voter: "early", weight: 100, choice: "For", timestamp: 100 },
      { voter: "late1", weight: 450, choice: "For", timestamp: 950 },
      { voter: "late2", weight: 450, choice: "Against", timestamp: 980 },
    ];
    const last = replay(
      { id: "late", start: 0, end: 1000, voteType: "single" },
      events,
    ).at(-1)!;
    expect(last.signals.lateWeightShare).toBeGreaterThan(0.8);
    expect(last.alerts.some((a) => a.signal === "late")).toBe(true);
  });

  it("does NOT fire when voting is spread evenly across the window", () => {
    const events: VoteEvent[] = [
      { voter: "a", weight: 100, choice: "For", timestamp: 100 },
      { voter: "b", weight: 100, choice: "For", timestamp: 400 },
      { voter: "c", weight: 100, choice: "Against", timestamp: 700 },
    ];
    const last = replay(
      { id: "even", start: 0, end: 1000, voteType: "single" },
      events,
    ).at(-1)!;
    expect(last.alerts.some((a) => a.signal === "late")).toBe(false);
  });
});

describe("batch analyze() matches replay()'s final frame (non-cluster fields)", () => {
  // Same synthetic capture scenario used above. analyze() is the one-shot path
  // for large proposals; it must agree with replay() on signals, counterfactuals
  // and robustness (cluster detection aside, which batch does not run yet).
  const proposal: ProposalContext = {
    id: "batch-parity",
    start: 1_000_000_000,
    end: 1_000_518_400,
    memberCount: 18_000,
    totalSupply: 100_000_000,
    quorumFraction: 0.01,
  };
  const events: VoteEvent[] = [
    { voter: "whale", weight: 1_005_000, choice: "For", timestamp: 1_000_003_600 },
    { voter: "w2", weight: 205, choice: "Against", timestamp: 1_000_090_000 },
    { voter: "w3", weight: 205, choice: "Against", timestamp: 1_000_176_400 },
    { voter: "w4", weight: 205, choice: "For", timestamp: 1_000_262_800 },
    { voter: "w5", weight: 205, choice: "Against", timestamp: 1_000_349_200 },
  ];

  const replayed = replay(proposal, events).at(-1)!;
  const batched = analyze(proposal, events);

  it("agrees on core signals", () => {
    expect(batched.signals.whaleShare).toBeCloseTo(replayed.signals.whaleShare, 10);
    expect(batched.signals.gini).toBeCloseTo(replayed.signals.gini, 10);
    expect(batched.signals.walletsFor50Pct).toBe(replayed.signals.walletsFor50Pct);
    expect(batched.signals.voterCount).toBe(replayed.signals.voterCount);
  });

  it("agrees on counterfactual winners and robustness", () => {
    for (const rule of ["1T1V", "QV", "1W1V", "GININORM"] as const) {
      expect(batched.outcomes.find((o) => o.rule === rule)!.winner).toBe(
        replayed.outcomes.find((o) => o.rule === rule)!.winner,
      );
    }
    expect(batched.robustness).toBe(replayed.robustness);
  });

  it("agrees on escalation", () => {
    expect(batched.escalated).toBe(replayed.escalated);
  });
});
