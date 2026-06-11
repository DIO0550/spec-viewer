import { expect, test } from "vitest";

import type { Comment } from "@/features/comments/domain/comment";
import { CommentSelection } from "@/features/comments/domain/commentSelection";
import type { CommentAnchor } from "@/features/comments/types/comment";
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

const firstComment: Comment = {
  id: commentId("cmt_1"),
  anchor,
  body: "Clarify this task",
  status: "open",
  resolved: false,
  createdAt: "2026-05-05T10:00:00Z",
  updatedAt: "2026-05-05T10:00:00Z",
};

const secondComment: Comment = {
  ...firstComment,
  id: commentId("cmt_2"),
  body: "Add acceptance criteria",
};

const thirdComment: Comment = {
  ...firstComment,
  id: commentId("cmt_3"),
  body: "Check the error path",
};

const comments: readonly Comment[] = [
  firstComment,
  secondComment,
  thirdComment,
];

test("resolveActiveCommentIdは選択なしでnullを返す", () => {
  expect(
    CommentSelection.resolveActiveCommentId({
      selectedCommentId: null,
      isListLoaded: true,
      comments,
    }),
  ).toBeNull();
});

test("resolveActiveCommentIdは読み込み済み一覧に存在する選択を維持する", () => {
  expect(
    CommentSelection.resolveActiveCommentId({
      selectedCommentId: commentId("cmt_2"),
      isListLoaded: true,
      comments,
    }),
  ).toBe(commentId("cmt_2"));
});

test("resolveActiveCommentIdは読み込み済み一覧から消えた選択をnullにする", () => {
  expect(
    CommentSelection.resolveActiveCommentId({
      selectedCommentId: commentId("cmt_missing"),
      isListLoaded: true,
      comments,
    }),
  ).toBeNull();
});

test("resolveActiveCommentIdは未読み込み中は選択を維持する", () => {
  expect(
    CommentSelection.resolveActiveCommentId({
      selectedCommentId: commentId("cmt_missing"),
      isListLoaded: false,
      comments: [],
    }),
  ).toBe(commentId("cmt_missing"));
});

test.each([
  ["next", "cmt_1", "cmt_2"],
  ["next", "cmt_3", "cmt_1"],
  ["previous", "cmt_2", "cmt_1"],
  ["previous", "cmt_1", "cmt_3"],
] as const)("adjacentCommentIdは%s方向へ巡回する(active=%s)", (direction, activeId, expectedId) => {
  expect(
    CommentSelection.adjacentCommentId({
      comments,
      activeCommentId: commentId(activeId),
      direction,
    }),
  ).toBe(commentId(expectedId));
});

test.each([
  ["next", "cmt_1"],
  ["previous", "cmt_3"],
] as const)("adjacentCommentIdは選択なしのとき%s方向の端から開始する", (direction, expectedId) => {
  expect(
    CommentSelection.adjacentCommentId({
      comments,
      activeCommentId: null,
      direction,
    }),
  ).toBe(commentId(expectedId));
});

test("adjacentCommentIdはコメントが無いときnullを返す", () => {
  expect(
    CommentSelection.adjacentCommentId({
      comments: [],
      activeCommentId: null,
      direction: "next",
    }),
  ).toBeNull();
});
