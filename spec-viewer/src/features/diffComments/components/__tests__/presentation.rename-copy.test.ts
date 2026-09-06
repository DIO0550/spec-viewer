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

test("複数行targetは終了行をcommand境界まで保持する", () => {
  expect(
    toAnchorTarget({
      key: "current:src/new.ts:15",
      side: "current",
      sidePath: "src/new.ts",
      oldPath: "src/old.ts",
      newPath: "src/new.ts",
      line: 12,
      endLine: 15,
    }),
  ).toEqual({
    side: "current",
    oldPath: "src/old.ts",
    newPath: "src/new.ts",
    line: 12,
    endLine: 15,
  });
});

test("複数行commentは再表示時に範囲の最終行へ配置する", () => {
  const comment = createResolvedComment(1);
  const rangedComment = {
    ...comment,
    anchor: { ...comment.anchor, endLine: 15 },
  };

  expect(
    groupCommentsByResolvedTarget([rangedComment])["current:src/new.ts:15"],
  ).toHaveLength(1);
  expect(toDiffReviewComments([rangedComment])[0]?.locationLabel).toBe(
    "src/new.ts current 12–15行目",
  );
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

test("行上には未解決コメントだけを表示する", () => {
  const openComment = createResolvedComment(1);
  const resolvedComment = {
    ...createResolvedComment(2),
    resolved: true,
  };

  const groups = groupCommentsByResolvedTarget([openComment, resolvedComment]);

  expect(groups["current:src/new.ts:12"]?.map((comment) => comment.id)).toEqual(
    ["comment-1"],
  );
});

test("現在のsnapshotで保存したコメントは解決一時失敗中も元の行に残す", () => {
  const comment = {
    ...createResolvedComment(1),
    anchorResolution: {
      status: "unavailable" as const,
      reason: "repositoryChanged" as const,
      canJump: false as const,
    },
  };
  const identity = {
    repositoryId: "repo",
    worktreeId: "worktree",
    baseSha: "base",
    currentSnapshotId: "snapshot",
  };

  expect(
    groupCommentsByResolvedTarget([comment], identity)["current:src/new.ts:12"],
  ).toHaveLength(1);
  expect(
    groupCommentsByResolvedTarget([comment], {
      ...identity,
      currentSnapshotId: "new-snapshot",
    }),
  ).toEqual({});
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
