import type { Snapshot } from "./types.js";

/**
 * Advisory report: the engine's findings in plain language.
 * Framing rules (BUILD_NOTES): never "prevented" — detection + time + evidence.
 */
export function buildReport(snapshot: Snapshot): string {
  const { proposal, signals, alerts, outcomes, robustness } = snapshot;
  const lines: string[] = [];

  lines.push(`# FlexGov Advisory Report — ${proposal.title ?? proposal.id}`);
  lines.push("");
  lines.push(
    `Votes analysed: ${snapshot.voteIndex} · Distinct voters: ${signals.voterCount} · Severity: ${snapshot.severity.toUpperCase()}`,
  );
  lines.push("");
  lines.push("## Signals");
  lines.push(`- Top wallet share: ${(signals.whaleShare * 100).toFixed(3)}%`);
  lines.push(`- Top-3 share: ${(signals.top3Share * 100).toFixed(3)}%`);
  lines.push(`- Gini (weight concentration): ${signals.gini.toFixed(4)}`);
  if (signals.turnout != null)
    lines.push(`- Turnout: ${(signals.turnout * 100).toFixed(3)}% of members`);
  if (signals.quorumProgress != null)
    lines.push(
      `- Quorum progress: ${(signals.quorumProgress * 100).toFixed(1)}%`,
    );
  lines.push("");

  if (alerts.length > 0) {
    lines.push("## Alerts (in firing order)");
    for (const a of alerts) {
      lines.push(
        `- [vote ${a.voteIndex}] ${a.severity.toUpperCase()} ${a.signal}: ${a.message}`,
      );
    }
    lines.push("");
  }

  lines.push("## Counterfactual outcomes");
  for (const o of outcomes) {
    lines.push(`- ${o.rule}: winner = ${o.winner ?? "tie/none"}`);
  }
  lines.push("");
  lines.push(`Robustness of the token-weighted outcome: **${robustness}**.`);
  if (snapshot.escalated) {
    lines.push("");
    lines.push(
      "A pre-authorised policy, had it been installed, would have frozen execution at the marked event and opened a review window — providing the community time and evidence before any treasury movement.",
    );
  }
  return lines.join("\n");
}
