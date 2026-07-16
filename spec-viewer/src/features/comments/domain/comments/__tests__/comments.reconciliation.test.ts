import { expect, test } from "vitest";
import { CommentStatusFilter } from "@/features/comments/domain/commentStatusFilter";
import { Comments } from "@/features/comments/domain/comments";
import { commentBody } from "@/features/comments/testing/comment-body-test-fixture";
import { createCommentTestFixture } from "@/features/comments/testing/comment-test-fixture";

const currentComment = createCommentTestFixture({
  updatedAt: "2026-05-05T10:10:00Z",
});
const updateInput = {
  commentId: currentComment.id,
  revision: {
    kind: "update",
    body: commentBody("Updated body"),
  },
} as const;

test("Comments.replaceExistingDisplayableはlatest currentより古いresponseを拒否する", () => {
  const comments = [currentComment] as const;
  const staleResponse = createCommentTestFixture({
    body: "Updated body",
    updatedAt: "2026-05-05T10:05:00Z",
  });

  expect(
    Comments.replaceExistingDisplayable(
      comments,
      staleResponse,
      updateInput,
      CommentStatusFilter.All,
    ),
  ).toMatchObject({
    ok: false,
    error: { reason: "updatedAtBeforePreviousUpdate" },
  });
  expect(comments[0]).toBe(currentComment);
});

test("Comments.replaceExistingDisplayableは期待IDと異なるresponseを拒否する", () => {
  const response = createCommentTestFixture({
    id: "cmt_other",
    body: "Updated body",
    updatedAt: "2026-05-05T10:15:00Z",
  });

  expect(
    Comments.replaceExistingDisplayable(
      [currentComment],
      response,
      updateInput,
      CommentStatusFilter.All,
    ),
  ).toMatchObject({
    ok: false,
    error: { reason: "commentIdMismatch" },
  });
});

test("Comments.replaceExistingDisplayableは対象不在を拒否する", () => {
  const response = createCommentTestFixture({
    body: "Updated body",
    updatedAt: "2026-05-05T10:15:00Z",
  });

  expect(
    Comments.replaceExistingDisplayable(
      [],
      response,
      updateInput,
      CommentStatusFilter.All,
    ),
  ).toMatchObject({
    ok: false,
    error: { reason: "commentNotFound", commentId: currentComment.id },
  });
});

test("Comments.removeは存在するIDを除外する", () => {
  const secondComment = createCommentTestFixture({ id: "cmt_2" });

  expect(
    Comments.remove([currentComment, secondComment], currentComment.id),
  ).toEqual([secondComment]);
});

test("Comments.removeは存在しないIDなら元配列参照を維持する", () => {
  const comments = [currentComment] as const;
  const missingId = createCommentTestFixture({ id: "cmt_missing" }).id;

  expect(Comments.remove(comments, missingId)).toBe(comments);
});
