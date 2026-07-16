import { expect, test } from "vitest";
import { CommentStatusFilter } from "@/features/comments/domain/commentStatusFilter";
import { Comments } from "@/features/comments/domain/comments";
import { createCommentTestFixture } from "@/features/comments/testing/comment-test-fixture";

const previousComment = createCommentTestFixture({ id: "cmt_1" });
const secondComment = createCommentTestFixture({ id: "cmt_2" });
const optimisticComment = createCommentTestFixture({
  id: previousComment.id,
  status: "resolved",
});

test("Comments.rollbackOptimisticToggleはvisibleなoptimistic targetだけを戻す", () => {
  const updatedSecondComment = createCommentTestFixture({
    id: secondComment.id,
    body: "Updated second comment",
    updatedAt: "2026-05-05T10:15:00Z",
  });

  expect(
    Comments.rollbackOptimisticToggle(
      [optimisticComment, updatedSecondComment],
      {
        commentId: previousComment.id,
        previousComments: [previousComment, secondComment],
        optimisticComments: [optimisticComment, secondComment],
        statusFilter: CommentStatusFilter.All,
      },
    ),
  ).toEqual([previousComment, updatedSecondComment]);
});

test("Comments.rollbackOptimisticToggleはreload済みtargetを上書きしない", () => {
  const authoritativeComment = createCommentTestFixture({
    id: previousComment.id,
    body: "Authoritative body",
    updatedAt: "2026-05-05T10:20:00Z",
  });
  const comments = [authoritativeComment, secondComment] as const;

  expect(
    Comments.rollbackOptimisticToggle(comments, {
      commentId: previousComment.id,
      previousComments: [previousComment, secondComment],
      optimisticComments: [optimisticComment, secondComment],
      statusFilter: CommentStatusFilter.All,
    }),
  ).toBe(comments);
});

test("Comments.rollbackOptimisticToggleはhidden targetを元位置だけへ戻す", () => {
  const updatedSecondComment = createCommentTestFixture({
    id: secondComment.id,
    body: "Updated second comment",
    updatedAt: "2026-05-05T10:15:00Z",
  });

  expect(
    Comments.rollbackOptimisticToggle([updatedSecondComment], {
      commentId: previousComment.id,
      previousComments: [previousComment, secondComment],
      optimisticComments: [secondComment],
      statusFilter: CommentStatusFilter.Open,
    }),
  ).toEqual([previousComment, updatedSecondComment]);
});

test("Comments.rollbackOptimisticToggleはhidden中に復元されたtargetを上書きしない", () => {
  const comments = [previousComment, secondComment] as const;

  expect(
    Comments.rollbackOptimisticToggle(comments, {
      commentId: previousComment.id,
      previousComments: [previousComment, secondComment],
      optimisticComments: [secondComment],
      statusFilter: CommentStatusFilter.Open,
    }),
  ).toBe(comments);
});
