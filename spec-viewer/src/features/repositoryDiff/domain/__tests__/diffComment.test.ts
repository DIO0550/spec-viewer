import { expect, test } from "vitest";

import {
  DiffCommentAnchor,
  isCanonicalDiffCommentRevision,
  type DiffCommentAnchor as DiffCommentAnchorValue,
} from "@/features/repositoryDiff/domain/diffComment";

const anchor: DiffCommentAnchorValue = {
  repositoryId: `rr1_${"a".repeat(64)}`,
  worktreeId: "/workspace",
  side: "base",
  oldPath: "src/old.ts",
  newPath: null,
  line: 2,
  baseSha: "b".repeat(40),
  currentSnapshotId: `rs1_${"c".repeat(64)}`,
  lineHash: "d".repeat(64),
  snippet: "line",
  context: "context",
};

test.each([
  { side: "base", oldPath: "src/old.ts", newPath: null },
  { side: "current", oldPath: null, newPath: "src/new.ts" },
] as const)("side=%sのDiff comment anchorを作成する", (overrides) => {
  const created = DiffCommentAnchor.create({ ...anchor, ...overrides });
  expect(created).toMatchObject(overrides);
});

test.each([
  { side: "base", oldPath: null, newPath: null },
  { side: "current", oldPath: "src/old.ts", newPath: null },
  { side: "base", oldPath: "src/old.ts", newPath: null, line: 0 },
] as const)("不正な Diff comment anchor=%sをrejectする", (overrides) => {
  expect(() => DiffCommentAnchor.create({ ...anchor, ...overrides })).toThrow(
    /Diff comment anchor/,
  );
});

test.each([
  "0",
  "1",
  "18446744073709551615",
] as const)("canonical revision=%sを受け入れる", (revision) => {
  expect(isCanonicalDiffCommentRevision(revision)).toBe(true);
});

test.each([
  "-1",
  "01",
  "18446744073709551616",
] as const)("不正な revision=%sを拒否する", (revision) => {
  expect(isCanonicalDiffCommentRevision(revision)).toBe(false);
});

test("runtime DiffCommentDto は Stored DTO に anchor resolution を追加できる", () => {
  const stored = {
    id: "comment-1",
    repositoryId: anchor.repositoryId,
    worktreeId: anchor.worktreeId,
    anchor,
    body: "review",
    status: "open" as const,
    revision: "0",
    createdAt: "2026-08-09T00:00:00Z",
    updatedAt: "2026-08-09T00:00:00Z",
  };
  const runtime = {
    ...stored,
    anchorResolution: {
      status: "relocated" as const,
      reason: "moved_by_hash",
      details: null,
    },
  };

  expect(runtime.anchorResolution).toEqual({
    status: "relocated",
    reason: "moved_by_hash",
    details: null,
  });
  expect(stored).not.toHaveProperty("anchorResolution");
});
