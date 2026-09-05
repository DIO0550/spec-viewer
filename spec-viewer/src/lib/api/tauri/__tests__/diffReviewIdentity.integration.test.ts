import { expect, test } from "vitest";

import { getDiffReviewIdentity } from "@/lib/api/tauri/diffComments";
import { decodeRepositoryOverview } from "@/lib/api/tauri/repositoryDiffDecoder";

const identity = {
  repositoryId: `rr1_${"a".repeat(64)}`,
  worktreeId: `rw1_${"b".repeat(64)}`,
  baseSha: "c".repeat(40),
  currentSnapshotId: `rs1_${"d".repeat(64)}`,
} as const;

const overview = {
  repositoryId: identity.repositoryId,
  base: {
    state: "resolved",
    source: "main",
    branchRef: "refs/heads/main",
    mergeBaseSha: identity.baseSha,
    headSha: "e".repeat(40),
    reason: null,
    candidates: [],
    overrideRef: null,
  },
  currentSnapshotId: identity.currentSnapshotId,
  diffReviewIdentity: identity,
  displayWorktreeLabel: "/workspace/repo",
  changed: [],
  changedTree: [],
  allRoot: [],
  all: [],
  ignoredDirectories: [],
  warnings: [],
} as const;

test("repository overviewのnested Diff identityを保持して取得する", () => {
  const decoded = decodeRepositoryOverview(overview);

  expect(getDiffReviewIdentity(decoded)).toEqual(identity);
  expect(decoded).toMatchObject({
    repositoryId: identity.repositoryId,
    base: {
      state: "resolved",
      source: "main",
      branchRef: "refs/heads/main",
      mergeBaseSha: identity.baseSha,
      headSha: "e".repeat(40),
    },
    currentSnapshotId: identity.currentSnapshotId,
    changed: [],
    changedTree: [],
    allRoot: [],
    allPaths: [],
    ignoredDirectories: [],
    warnings: [],
  });
});

test("overview top-level identityと不一致のnested Diff identityを拒否する", () => {
  expect(() =>
    decodeRepositoryOverview({
      ...overview,
      diffReviewIdentity: { ...identity, baseSha: "f".repeat(40) },
    }),
  ).toThrow(/Diff review identity/);
});

test("base未解決overviewのnull Diff identityを未提供としてdecodeする", () => {
  const decoded = decodeRepositoryOverview({
    ...overview,
    base: {
      state: "needsSelection",
      source: null,
      branchRef: null,
      mergeBaseSha: null,
      headSha: null,
      reason: "notFound",
      candidates: [],
      overrideRef: null,
    },
    currentSnapshotId: null,
    diffReviewIdentity: null,
  });

  expect(getDiffReviewIdentity(decoded)).toBeNull();
});
