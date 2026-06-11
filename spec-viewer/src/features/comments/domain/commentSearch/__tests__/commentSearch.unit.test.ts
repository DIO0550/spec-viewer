import { expect, test } from "vitest";

import type { Comment } from "@/features/comments/domain/comment";
import { CommentSearch } from "@/features/comments/domain/commentSearch";
import type {
  CommentAnchor,
  CommentAnchorDisplayStatus,
} from "@/features/comments/types/comment";
import { CommentId } from "@/features/comments/types/comment";

const commentId = CommentId.fromString;

const anchor: CommentAnchor = {
  fileKey: "tasks",
  blockType: "paragraph",
  blockIndex: 0,
  textHash: "sha256:first",
  textSnippet: "Users can scan comments",
  charRange: {
    start: 0,
    end: 24,
  },
};

const openComment: Comment = {
  id: commentId("cmt_open"),
  anchor,
  body: "Clarify the acceptance criteria",
  status: "open",
  resolved: false,
  createdAt: "2026-05-05T10:00:00Z",
  updatedAt: "2026-05-05T10:00:00Z",
};

const resolvedComment: Comment = {
  ...openComment,
  id: commentId("cmt_resolved"),
  body: "This item is covered",
  status: "resolved",
  resolved: true,
};

const emptyStatusMap: ReadonlyMap<
  ReturnType<typeof commentId>,
  CommentAnchorDisplayStatus
> = new Map();

test.each([
  ["  Phase   1  ", "phase 1"],
  ["ABC", "abc"],
  ["", ""],
  ["   ", ""],
])("normalizeQueryは空白を圧縮し小文字化する(%j)", (input, expected) => {
  expect(CommentSearch.normalizeQuery(input)).toBe(expected);
});

test("matchesは本文に一致するコメントを検出する", () => {
  expect(CommentSearch.matches(openComment, "acceptance", "exact")).toBe(true);
});

test("matchesはアンカー断片に一致するコメントを検出する", () => {
  expect(CommentSearch.matches(openComment, "scan comments", "exact")).toBe(
    true,
  );
});

test("matchesはアンカー状態ラベルに一致するコメントを検出する", () => {
  expect(CommentSearch.matches(openComment, "移動", "moved")).toBe(true);
});

test("matchesは一致しないクエリでfalseを返す", () => {
  expect(CommentSearch.matches(openComment, "存在しない語", "exact")).toBe(
    false,
  );
});

test("filterCommentsは空クエリで全件返す", () => {
  const comments = [openComment, resolvedComment];

  expect(
    CommentSearch.filterComments({
      comments,
      searchQuery: "",
      anchorDisplayStatusByCommentId: emptyStatusMap,
    }),
  ).toBe(comments);
});

test("filterCommentsはクエリに一致するコメントだけ返す", () => {
  expect(
    CommentSearch.filterComments({
      comments: [openComment, resolvedComment],
      searchQuery: "covered",
      anchorDisplayStatusByCommentId: emptyStatusMap,
    }),
  ).toEqual([resolvedComment]);
});

test.each([
  [0, "0件"],
  [1, "1件"],
  [12, "12件"],
])("formatResultCountは件数ラベルを返す(%i)", (count, expected) => {
  expect(CommentSearch.formatResultCount(count)).toBe(expected);
});
