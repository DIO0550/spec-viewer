import { expect, test } from "vitest";
import { CommentStatusFilter } from "@/features/comments/domain/commentStatusFilter";
import { Comments } from "@/features/comments/domain/comments";
import { commentBody } from "@/features/comments/testing/comment-body-test-fixture";
import { createCommentTestFixture } from "@/features/comments/testing/comment-test-fixture";

const previousComment = createCommentTestFixture({
  id: "cmt_1",
  updatedAt: "2026-05-05T10:05:00Z",
});
const response = createCommentTestFixture({
  id: "cmt_1",
  body: "Updated body",
  updatedAt: "2026-05-05T10:10:00Z",
});
const revision = {
  commentId: previousComment.id,
  revision: { kind: "update", body: commentBody(response.body) },
} as const;

test("Comments.applyValidatedRevisionはlatest currentへresponseを再検証して置換する", () => {
  const currentComment = createCommentTestFixture({
    id: previousComment.id,
    updatedAt: "2026-05-05T10:08:00Z",
  });

  expect(
    Comments.applyValidatedRevision([currentComment], {
      response,
      revision,
      previousComments: [previousComment],
      statusFilter: CommentStatusFilter.All,
    }),
  ).toEqual({
    ok: true,
    value: { comments: [response], comment: response },
  });
});

test("Comments.applyValidatedRevisionはlatest currentより古いresponseを拒否する", () => {
  const currentComment = createCommentTestFixture({
    id: previousComment.id,
    body: "Newer body",
    updatedAt: "2026-05-05T10:15:00Z",
  });

  expect(
    Comments.applyValidatedRevision([currentComment], {
      response,
      revision,
      previousComments: [previousComment],
      statusFilter: CommentStatusFilter.All,
    }),
  ).toMatchObject({
    ok: false,
    error: { reason: "updatedAtBeforePreviousUpdate" },
  });
});

test("Comments.applyValidatedRevisionはfilter非表示のmissing targetを成功no-opにする", () => {
  const resolvedResponse = createCommentTestFixture({
    id: previousComment.id,
    status: "resolved",
    updatedAt: "2026-05-05T10:10:00Z",
  });
  const comments = [createCommentTestFixture({ id: "cmt_2" })] as const;

  expect(
    Comments.applyValidatedRevision(comments, {
      response: resolvedResponse,
      revision: {
        commentId: previousComment.id,
        revision: { kind: "resolve" },
      },
      previousComments: [previousComment, ...comments],
      statusFilter: CommentStatusFilter.Open,
    }),
  ).toEqual({
    ok: true,
    value: { comments, comment: resolvedResponse },
  });
});

test("Comments.applyValidatedRevisionはdisplayableなmissing targetを元位置へ挿入する", () => {
  const leadingComment = createCommentTestFixture({ id: "cmt_leading" });
  const trailingComment = createCommentTestFixture({ id: "cmt_trailing" });

  expect(
    Comments.applyValidatedRevision([leadingComment, trailingComment], {
      response,
      revision,
      previousComments: [leadingComment, previousComment, trailingComment],
      statusFilter: CommentStatusFilter.All,
    }),
  ).toEqual({
    ok: true,
    value: {
      comments: [leadingComment, response, trailingComment],
      comment: response,
    },
  });
});
