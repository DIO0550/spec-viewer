import { expect, test } from "vitest";

import type { ResolvedDiffComment } from "@/features/diffComments";
import {
  groupCommentsByResolvedTarget,
  toAnchorTarget,
  toDiffReviewComments,
} from "@/features/diffComments/components/presentation";

test.each([
  "base",
  "current",
] as const)("rename/copyの%s側targetはoldPathとnewPathをcommand境界まで保持する", (side) => {
  expect(
    toAnchorTarget({
      key: `${side}:src/old.ts:12`,
      side,
      sidePath: side === "base" ? "src/old.ts" : "src/new.ts",
      oldPath: "src/old.ts",
      newPath: "src/new.ts",
      line: 12,
    }),
  ).toEqual({
    side,
    oldPath: "src/old.ts",
    newPath: "src/new.ts",
    line: 12,
  });
});

test("20k収束commentを線形時間でgroup化し全件を保持する", () => {
  const comments = Array.from({ length: 20_000 }, (_, index) =>
    createResolvedComment(index),
  );
  const startedAt = performance.now();

  const groups = groupCommentsByResolvedTarget(comments);

  expect(groups["current:src/new.ts:12"]).toHaveLength(20_000);
  expect(performance.now() - startedAt).toBeLessThan(1_000);
});

test("Review presentationはtree selectionPathとviewer sidePathを区別して保持する", () => {
  const presented = toDiffReviewComments([createResolvedComment(1)])[0];

  expect(presented?.resolution).toMatchObject({
    status: "relocated",
    selectionPath: "src/new.ts",
    sidePath: "src/new.ts",
    side: "current",
    line: 12,
  });
});

function createResolvedComment(index: number): ResolvedDiffComment {
  return {
    id: `comment-${index}`,
    body: `body-${index}`,
    resolved: false,
    createdAt: `2026-01-01T00:00:${String(index % 60).padStart(2, "0")}Z`,
    anchor: {
      repositoryId: "repo",
      worktreeId: "worktree",
      baseSha: "base",
      currentSnapshotId: "snapshot",
      side: "current",
      oldPath: "src/old.ts",
      newPath: "src/new.ts",
      line: 12,
      lineHash: "hash",
      snippet: "line",
      contextBefore: [],
      contextAfter: [],
    },
    anchorResolution: {
      status: "relocated",
      selectionPath: "src/new.ts",
      sidePath: "src/new.ts",
      side: "current",
      line: 12,
    },
  };
}
