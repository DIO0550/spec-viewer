import { expect, test } from "vitest";

import { Comment } from "@/features/comments/domain/comment";
import { createCommentAnchorTestFixture } from "@/features/comments/testing/comment-anchor-test-fixture";
import { commentBody } from "@/features/comments/testing/comment-body-test-fixture";
import { createCommentTestFixture } from "@/features/comments/testing/comment-test-fixture";

const expectedBody = commentBody("Created body");
const createdComment = createCommentTestFixture({
  id: "cmt_created",
  body: expectedBody,
});

test("Comment.reconcileCreationはcreate契約と一致するresponseを受理する", () => {
  expect(
    Comment.reconcileCreation(createdComment, {
      anchor: createdComment.anchor,
      body: expectedBody,
    }),
  ).toEqual({ ok: true, value: createdComment });
});

test.each([
  [
    "anchorMismatch",
    createdComment,
    createCommentAnchorTestFixture({
      blockIndex: 1,
      textHash: "sha256:b00b1e02",
      textSnippet: "Moved task",
      charRange: { start: 0, end: 10 },
    }),
    expectedBody,
  ],
  [
    "bodyMismatch",
    createCommentTestFixture({
      id: "cmt_created",
      body: "Unexpected body",
    }),
    createdComment.anchor,
    expectedBody,
  ],
  [
    "statusMismatch",
    createCommentTestFixture({
      id: "cmt_created",
      body: expectedBody,
      status: "resolved",
    }),
    createdComment.anchor,
    expectedBody,
  ],
  [
    "creationTimestampMismatch",
    createCommentTestFixture({
      id: "cmt_created",
      body: expectedBody,
      updatedAt: "2026-05-05T10:01:00Z",
    }),
    createdComment.anchor,
    expectedBody,
  ],
] as const)("Comment.reconcileCreationは%s responseを拒否する", (reason, response, anchor, body) => {
  expect(Comment.reconcileCreation(response, { anchor, body })).toMatchObject({
    ok: false,
    error: { reason },
  });
});
