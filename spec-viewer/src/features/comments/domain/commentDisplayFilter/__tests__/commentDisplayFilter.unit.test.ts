import { expect, test } from "vitest";

import type { Comment } from "@/features/comments/domain/comment";
import { CommentDisplayFilter } from "@/features/comments/domain/commentDisplayFilter";
import type {
  CommentAnchor,
  CommentAnchorDisplayState,
} from "@/features/comments/types/comment";
import { CommentId } from "@/features/comments/types/comment";

const commentId = CommentId.fromString;

const anchor: CommentAnchor = {
  fileKey: "tasks",
  blockType: "paragraph",
  blockIndex: 0,
  textHash: "sha256:first",
  textSnippet: "Clarify this task",
  charRange: {
    start: 0,
    end: 18,
  },
};

const openComment: Comment = {
  id: commentId("cmt_open"),
  anchor,
  body: "Clarify this task",
  status: "open",
  resolved: false,
  createdAt: "2026-05-05T10:00:00Z",
  updatedAt: "2026-05-05T10:00:00Z",
};

const resolvedComment: Comment = {
  ...openComment,
  id: commentId("cmt_resolved"),
  status: "resolved",
  resolved: true,
};

const movedComment: Comment = {
  ...openComment,
  id: commentId("cmt_moved"),
};

const anchorDisplayStates: readonly CommentAnchorDisplayState[] = [
  { commentId: movedComment.id, status: "moved" },
];

const statusMap =
  CommentDisplayFilter.createAnchorDisplayStatusByCommentId(
    anchorDisplayStates,
  );

const allComments: readonly Comment[] = [
  openComment,
  resolvedComment,
  movedComment,
];

test("createAnchorDisplayStatusByCommentIdはコメントIDで引ける", () => {
  expect(statusMap.get(movedComment.id)).toBe("moved");
  expect(statusMap.get(openComment.id)).toBeUndefined();
});

test("groupByStatusは未解決と解決済みに分割する", () => {
  expect(CommentDisplayFilter.groupByStatus(allComments)).toEqual({
    openComments: [openComment, movedComment],
    resolvedComments: [resolvedComment],
  });
});

test("emptyCountsは全フィルタを0で初期化する", () => {
  expect(CommentDisplayFilter.emptyCounts()).toEqual({
    all: 0,
    open: 0,
    resolved: 0,
    moved: 0,
    fuzzy: 0,
    stale: 0,
    orphaned: 0,
  });
});

test("countCommentsはフィルタ別の件数を集計する", () => {
  expect(CommentDisplayFilter.countComments(allComments, statusMap)).toEqual({
    all: 3,
    open: 2,
    resolved: 1,
    moved: 1,
    fuzzy: 0,
    stale: 0,
    orphaned: 0,
  });
});

test.each([
  ["all", ["cmt_open", "cmt_resolved", "cmt_moved"]],
  ["open", ["cmt_open", "cmt_moved"]],
  ["resolved", ["cmt_resolved"]],
  ["moved", ["cmt_moved"]],
  ["orphaned", []],
] as const)("filterCommentsは%sフィルタで対象を絞る", (filter, expectedIds) => {
  const filtered = CommentDisplayFilter.filterComments(
    allComments,
    filter,
    statusMap,
  );

  expect(filtered.map((comment) => comment.id)).toEqual(
    expectedIds.map((id) => commentId(id)),
  );
});

test.each([
  ["all", "すべて"],
  ["open", "未解決"],
  ["resolved", "解決済み"],
  ["moved", "移動"],
] as const)("formatLabelは%sのラベルを返す", (filter, expected) => {
  expect(CommentDisplayFilter.formatLabel(filter)).toBe(expected);
});

test("createSectionModelsはallフィルタで未解決と解決済みの2セクションを返す", () => {
  const models = CommentDisplayFilter.createSectionModels("all", allComments);

  expect(models.map((model) => model.id)).toEqual([
    "comment-section-open",
    "comment-section-resolved",
  ]);
  expect(models[0]?.comments).toEqual([openComment, movedComment]);
  expect(models[1]?.comments).toEqual([resolvedComment]);
});

test("createSectionModelsは個別フィルタで1セクションを返す", () => {
  const models = CommentDisplayFilter.createSectionModels("moved", [
    movedComment,
  ]);

  expect(models).toHaveLength(1);
  expect(models[0]?.id).toBe("comment-section-moved");
  expect(models[0]?.comments).toEqual([movedComment]);
});
