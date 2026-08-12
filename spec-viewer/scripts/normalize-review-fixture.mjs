#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const VERSION = 1;
const categories = new Map([
  ["repositoryId", "REPOSITORY_ID"],
  ["worktreeId", "WORKTREE_ID"],
  ["currentSnapshotId", "SNAPSHOT_ID"],
  ["snapshotId", "SNAPSHOT_ID"],
  ["baseSha", "SHA"],
  ["sha", "SHA"],
  ["createdAt", "TIMESTAMP"],
  ["updatedAt", "TIMESTAMP"],
  ["timestamp", "TIMESTAMP"],
  ["absolutePath", "ABSOLUTE_PATH"],
]);
const pathKeys = new Set([
  "path",
  "oldPath",
  "newPath",
  "sidePath",
  "selectionPath",
]);

/** Replaces only explicitly typed volatile DTO fields with stable placeholders. */
export function normalizeReviewFixture(value) {
  const identities = new Map();
  const counters = new Map();
  const placeholder = (category, raw) => {
    const key = `${category}\0${raw}`;
    if (!identities.has(key)) {
      const next = (counters.get(category) ?? 0) + 1;
      counters.set(category, next);
      identities.set(key, `<${category}:${next}>`);
    }
    return identities.get(key);
  };
  const visit = (current, key = "") => {
    if (Array.isArray(current)) return current.map((entry) => visit(entry));
    if (current === null || typeof current !== "object") {
      if (typeof current !== "string") return current;
      const category = categories.get(key);
      if (category) return placeholder(category, current);
      if (pathKeys.has(key)) return current.replaceAll("\\", "/");
      if (/nonce|random|temporary/i.test(key))
        throw new Error(`unknown volatile field ${key}`);
      return current;
    }
    return Object.fromEntries(
      Object.entries(current).map(([childKey, child]) => [
        childKey,
        visit(child, childKey),
      ]),
    );
  };
  return visit(value);
}

export function createGoldenMetadata(raw, command) {
  return {
    command,
    normalizerVersion: VERSION,
    rawHash: `sha256:${createHash("sha256").update(raw).digest("hex")}`,
  };
}

if (
  process.argv[1]?.endsWith("normalize-review-fixture.mjs") &&
  process.argv[2]
) {
  const source = readFileSync(process.argv[2], "utf8");
  const normalized = normalizeReviewFixture(JSON.parse(source));
  writeFileSync(
    process.argv[3] ?? `${process.argv[2]}.normalized.json`,
    `${JSON.stringify(normalized, null, 2)}\n`,
    { flag: "wx" },
  );
}
