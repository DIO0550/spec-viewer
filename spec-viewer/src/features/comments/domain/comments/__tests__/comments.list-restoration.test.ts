import { expect, test } from "vitest";
import { CommentStatusFilter } from "@/features/comments/domain/commentStatusFilter";
import { Comments } from "@/features/comments/domain/comments";
import { createCommentTestFixture } from "@/features/comments/testing/comment-test-fixture";

const openComment = createCommentTestFixture({ id: "cmt_open" });
const resolvedComment = createCommentTestFixture({
  id: "cmt_resolved",
  status: "resolved",
  updatedAt: "2026-05-05T10:10:00Z",
});

test("Comments.restoreListは順序を保った新しいcollectionを返す", () => {
  const comments = [openComment, resolvedComment] as const;
  const result = Comments.restoreList(comments, CommentStatusFilter.All);

  expect(result).toEqual({
    ok: true,
    value: [openComment, resolvedComment],
  });
  expect(result.ok && result.value).not.toBe(comments);
});

test("Comments.restoreListは重複IDを拒否する", () => {
  const duplicate = createCommentTestFixture({
    id: openComment.id,
    body: "Duplicate identity",
  });

  expect(
    Comments.restoreList([openComment, duplicate], CommentStatusFilter.All),
  ).toEqual({
    ok: false,
    error: {
      reason: "duplicateCommentId",
      commentId: openComment.id,
      firstIndex: 0,
      duplicateIndex: 1,
    },
  });
});

test.each([
  [CommentStatusFilter.Open, resolvedComment],
  [CommentStatusFilter.Resolved, openComment],
] as const)("Comments.restoreListは%s filter対象外のcommentを拒否する", (statusFilter, comment) => {
  expect(Comments.restoreList([comment], statusFilter)).toEqual({
    ok: false,
    error: {
      reason: "statusFilterMismatch",
      commentId: comment.id,
      index: 0,
      expectedStatusFilter: statusFilter,
      actualStatus: comment.status,
    },
  });
});
