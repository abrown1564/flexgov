import type { GovernanceHealthReport } from "./health-report.js";

type WebCryptoLike = {
  subtle: {
    digest(algorithm: string, data: Uint8Array): Promise<ArrayBuffer>;
  };
};

type TextEncoderConstructor = new () => {
  encode(input: string): Uint8Array;
};

/**
 * Deterministic JSON with object keys sorted recursively.
 *
 * Ordinary JSON.stringify preserves insertion order, so two equivalent report
 * objects assembled in different key orders can produce different bytes. A
 * stable representation is essential before a digest can be independently
 * reproduced or anchored on-chain.
 */
export function canonicalJson(value: unknown): string {
  if (value === null) return "null";

  if (typeof value === "string" || typeof value === "boolean") {
    return JSON.stringify(value);
  }

  if (typeof value === "number") {
    // Match JSON.stringify: non-finite numbers serialise as null.
    return Number.isFinite(value) ? JSON.stringify(value) : "null";
  }

  if (Array.isArray(value)) {
    return `[${value
      .map((item) =>
        item === undefined ||
        typeof item === "function" ||
        typeof item === "symbol"
          ? "null"
          : canonicalJson(item),
      )
      .join(",")}]`;
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const entries = Object.keys(record)
      .sort()
      // Match JSON.stringify by omitting unsupported object properties.
      .filter((key) => {
        const item = record[key];
        return (
          item !== undefined &&
          typeof item !== "function" &&
          typeof item !== "symbol"
        );
      })
      .map(
        (key) =>
          `${JSON.stringify(key)}:${canonicalJson(record[key])}`,
      );
    return `{${entries.join(",")}}`;
  }

  throw new TypeError(`Cannot canonicalise value of type ${typeof value}`);
}

/**
 * SHA-256 using the Web Crypto API shared by modern browsers and Node.
 *
 * The engine remains dependency-free. Explicit structural types let the core
 * package target ES2022 while the same function runs in both environments.
 */
export async function sha256Hex(value: string): Promise<string> {
  const runtime = globalThis as unknown as {
    crypto?: WebCryptoLike;
    TextEncoder?: TextEncoderConstructor;
  };

  if (!runtime.crypto?.subtle || !runtime.TextEncoder) {
    throw new Error("SHA-256 requires the Web Crypto API and TextEncoder.");
  }

  const bytes = new runtime.TextEncoder().encode(value);
  const digest = await runtime.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

/**
 * Hash the immutable report content, excluding its verification envelope.
 *
 * The envelope is populated after hashing and may later gain storage or chain
 * attestations. Excluding it avoids a self-referential hash and ensures those
 * delivery references do not change the identity of the underlying analysis.
 */
export async function hashGovernanceHealthReport(
  report: GovernanceHealthReport,
): Promise<string> {
  const { verification: _verification, ...reportContent } = report;
  return sha256Hex(canonicalJson(reportContent));
}
