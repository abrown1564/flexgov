"use client";

/**
 * Adapter: Snapshot Hub data -> FlexGov engine.
 *
 * The engine is source-agnostic: it consumes VoteEvent[] + a ProposalContext.
 * This file is the only place that knows how Snapshot's shapes map onto the
 * engine, keeping that translation out of the React component. Any future
 * source (Governor subgraph, Realms) gets its own adapter with the same output.
 *
 * The engine has zero runtime dependencies and is imported directly from its
 * TypeScript source (relative path) — no build or publish step required.
 */

import { analyze } from "../../../engine/src/index.js";
import type {
  Choice,
  ProposalContext,
  Snapshot as EngineSnapshot,
  VoteEvent,
  VoteType,
} from "../../../engine/src/index.js";

/** The Snapshot proposal fields this adapter needs. */
export interface SnapshotProposalInput {
  id: string;
  title: string;
  start: number;
  end: number;
  choices: string[];
  /** Snapshot's voting-type string, e.g. "single-choice", "ranked-choice". */
  type?: string;
}

/** The Snapshot vote fields this adapter needs. */
export interface SnapshotVoteInput {
  voter: string;
  /** Snapshot voting power. */
  vp: number;
  /** number | number[] | Record<string, number> — Snapshot ballot shapes. */
  choice: number | number[] | Record<string, number>;
  /** Unix seconds. */
  created: number;
}

/**
 * Map Snapshot's voting-type string to the engine's VoteType. Snapshot uses
 * hyphenated names ("single-choice", "ranked-choice") which we normalise.
 * Unknown/absent -> undefined, so the engine falls back to shape inference.
 */
export function mapSnapshotVoteType(type?: string): VoteType | undefined {
  switch (type) {
    case "single-choice":
      return "single";
    case "basic":
      return "basic";
    case "approval":
      return "approval";
    case "ranked-choice":
      return "ranked";
    case "weighted":
      return "weighted";
    case "quadratic":
      return "quadratic";
    default:
      return undefined;
  }
}

/** A Snapshot ballot maps 1:1 onto the engine's Choice union. */
function toEngineChoice(choice: SnapshotVoteInput["choice"]): Choice {
  return choice as Choice;
}

/** Build a ProposalContext from a Snapshot proposal. */
export function toProposalContext(p: SnapshotProposalInput): ProposalContext {
  return {
    id: p.id,
    title: p.title,
    start: p.start,
    end: p.end,
    choices: p.choices,
    voteType: mapSnapshotVoteType(p.type),
    // Snapshot Hub does not expose total supply / quorum / member count, so
    // quorum-capture and turnout signals stay dark for Snapshot proposals.
    // The on-chain Governor adapter will supply those later.
  };
}

/** Convert Snapshot votes into the engine's ordered VoteEvent stream. */
export function toVoteEvents(votes: readonly SnapshotVoteInput[]): VoteEvent[] {
  return votes.map((v) => ({
    voter: v.voter,
    weight: v.vp,
    choice: toEngineChoice(v.choice),
    timestamp: v.created,
  }));
}

/**
 * Run the engine over a Snapshot proposal's votes and return the analysis.
 * Uses the one-shot batch analyze() (not replay()) so large proposals — tens of
 * thousands of votes — compute in a fraction of a second without freezing the
 * tab. Returns null if there are no votes to analyse.
 */
export function analyseSnapshotProposal(
  proposal: SnapshotProposalInput,
  votes: readonly SnapshotVoteInput[],
): EngineSnapshot | null {
  if (votes.length === 0) return null;
  return analyze(toProposalContext(proposal), toVoteEvents(votes));
}
