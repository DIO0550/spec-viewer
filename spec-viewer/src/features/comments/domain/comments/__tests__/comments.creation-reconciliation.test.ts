import { expect, test } from "vitest";
import { CommentStatusFilter } from "@/features/comments/domain/commentStatusFilter";
import {
  Comments,
  type CommentsReconciliationResult,
} from "@/features/comments/domain/comments";
import { createCommentTestFixture } from "@/features/comments/testing/comment-test-fixture";

const openComment = createCommentTestFixture();
const createdComment = createCommentTestFixture({
  id: "cmt_2",
  body: "Add acceptance criteria",
  createdAt: "2026-05-05T10:05:00Z",
  updatedAt: "2026-05-05T10:05:00Z",
});
const expectation = {
  anchor: createdComment.anchor,
  body: createdComment.body,
};

test("Comments.appendDisplayableは表示対象コメントを末尾に追加する", () => {
  expect(
    Comments.appendDisplayable(
      [openComment],
      createdComment,
      expectation,
      CommentStatusFilter.Open,
    ),
  ).toEqual({
    ok: true,
    value: {
      comments: [openComment, createdComment],
      comment: createdComment,
    },
  });
});

test("Comments.appendDisplayableはfilter対象外なら元配列を返す", () => {
  const comments = [openComment] as const;
  const result = Comments.appendDisplayable(
    comments,
    createdComment,
    expectation,
    CommentStatusFilter.Resolved,
  );

  expect(result.ok).toBe(true);
  const success = result as Extract<
    CommentsReconciliationResult,
    Readonly<{ ok: true }>
  >;
  expect(success.value.comments).toBe(comments);
});

test("Comments.appendDisplayableは解決情報付きでreload済みの同一aggregateを冪等成功にする", () => {
  const reloadedCreatedComment = createCommentTestFixture({
    id: "cmt_2",
    body: "Add acceptance criteria",
    anchorResolution: {
      status: "moved",
      reason: "moved_by_hash",
      details: "Moved to a nearby block.",
      target: null,
    },
    createdAt: "2026-05-05T10:05:00Z",
    updatedAt: "2026-05-05T10:05:00Z",
  });
  const comments = [openComment, reloadedCreatedComment] as const;
  const result = Comments.appendDisplayable(
    comments,
    createdComment,
    expectation,
    CommentStatusFilter.All,
  );

  expect(result).toMatchObject({ ok: true });
  const success = result as Extract<
    CommentsReconciliationResult,
    Readonly<{ ok: true }>
  >;
  expect(success.value.comments).toBe(comments);
  expect(success.value.comment).toBe(reloadedCreatedComment);
});

test("Comments.appendDisplayableは同一idの異なるaggregateを拒否する", () => {
  const conflictingComment = createCommentTestFixture({
    id: "cmt_2",
    body: "Add acceptance criteria",
    createdAt: "2026-05-05T10:06:00Z",
    updatedAt: "2026-05-05T10:06:00Z",
  });

  expect(
    Comments.appendDisplayable(
      [openComment, conflictingComment],
      createdComment,
      expectation,
      CommentStatusFilter.All,
    ),
  ).toMatchObject({
    ok: false,
    error: { reason: "duplicateCommentId" },
  });
});
