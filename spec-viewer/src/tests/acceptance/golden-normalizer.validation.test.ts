import { expect, it } from "vitest";

import { normalizeReviewFixture } from "../../../scripts/normalize-review-fixture.mjs";

it("normalizer preserves repeated identity references and separates distinct values", () => {
  const normalized = normalizeReviewFixture({
    repositoryId: "rr1_aaa",
    nested: { repositoryId: "rr1_aaa", worktreeId: "rw1_bbb" },
    other: { worktreeId: "rw1_ccc" },
  });
  expect(normalized.repositoryId).toBe(normalized.nested.repositoryId);
  expect(normalized.nested.worktreeId).not.toBe(normalized.other.worktreeId);
});

it("normalizer replaces only typed volatile values while preserving anchor semantics", () => {
  expect(
    normalizeReviewFixture({
      absolutePath: "/tmp/run-42/spec.md",
      baseSha: "a".repeat(40),
      currentSnapshotId: `rs1_${"b".repeat(64)}`,
      createdAt: "2026-08-12T00:00:00Z",
      side: "current",
      path: "specs\\plan.md",
      revision: "9",
      commentId: "comment-1",
    }),
  ).toEqual({
    absolutePath: "<ABSOLUTE_PATH:1>",
    baseSha: "<SHA:1>",
    currentSnapshotId: "<SNAPSHOT_ID:1>",
    createdAt: "<TIMESTAMP:1>",
    side: "current",
    path: "specs/plan.md",
    revision: "9",
    commentId: "comment-1",
  });
});

it("normalizer rejects unknown volatile fields instead of deleting them", () => {
  expect(() => normalizeReviewFixture({ randomNonce: "volatile" })).toThrow(
    /unknown volatile/i,
  );
});
