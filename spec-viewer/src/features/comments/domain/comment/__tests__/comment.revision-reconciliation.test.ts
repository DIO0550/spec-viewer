import { expect, test } from "vitest";

import { Comment } from "@/features/comments/domain/comment";
import { createCommentAnchorTestFixture } from "@/features/comments/testing/comment-anchor-test-fixture";
import { commentBody } from "@/features/comments/testing/comment-body-test-fixture";
import {
  type CommentTestFixtureInput,
  createCommentTestFixture,
} from "@/features/comments/testing/comment-test-fixture";

const currentComment = createCommentTestFixture({
  updatedAt: "2026-05-05T10:10:00Z",
});
const resolvedCurrent = createCommentTestFixture({
  status: "resolved",
  updatedAt: "2026-05-05T10:10:00Z",
});
const updatedComment = createUpdateResponse();
const updateExpectation = {
  kind: "update",
  body: commentBody("Updated body"),
} as const;

test("Comment.reconcileRevisionはupdate期待値と一致するresponseを適用する", () => {
  expect(
    Comment.reconcileRevision(
      currentComment,
      updatedComment,
      updateExpectation,
    ),
  ).toEqual({ ok: true, value: updatedComment });
});

test.each([
  [
    "resolve",
    currentComment,
    createUpdateResponse({ body: currentComment.body, status: "resolved" }),
    { kind: "resolve" },
  ],
  [
    "reopen",
    resolvedCurrent,
    createUpdateResponse({ body: resolvedCurrent.body }),
    { kind: "reopen" },
  ],
  [
    "toggle openからresolved",
    currentComment,
    createUpdateResponse({ body: currentComment.body, status: "resolved" }),
    { kind: "toggle", status: "resolved" },
  ],
  [
    "toggle resolvedからopen",
    resolvedCurrent,
    createUpdateResponse({ body: resolvedCurrent.body }),
    { kind: "toggle", status: "open" },
  ],
] as const)("Comment.reconcileRevisionは%s期待値と一致するresponseを適用する", (_label, current, response, expectation) => {
  expect(Comment.reconcileRevision(current, response, expectation)).toEqual({
    ok: true,
    value: response,
  });
});

test.each([
  ["commentIdMismatch", { id: "cmt_other" }],
  [
    "createdAtMismatch",
    {
      createdAt: "2026-05-05T09:00:00Z",
      updatedAt: "2026-05-05T10:15:00Z",
    },
  ],
  [
    "anchorMismatch",
    {
      anchor: createCommentAnchorTestFixture({
        blockIndex: 1,
        textHash: "sha256:b00b1e02",
        textSnippet: "Moved task",
        charRange: { start: 0, end: 10 },
      }),
    },
  ],
  ["updatedAtBeforePreviousUpdate", { updatedAt: "2026-05-05T10:05:00Z" }],
  ["bodyMismatch", { body: "Unexpected body" }],
  ["statusMismatch", { status: "resolved" }],
] as const)("Comment.reconcileRevisionは%s responseを拒否する", (reason, overrides) => {
  expect(
    Comment.reconcileRevision(
      currentComment,
      createUpdateResponse(overrides),
      updateExpectation,
    ),
  ).toMatchObject({ ok: false, error: { reason } });
});

test("Comment.reconcileRevisionはstatus operationでbody変更を拒否する", () => {
  const response = createUpdateResponse({
    body: "Unexpected body",
    status: "resolved",
  });

  expect(
    Comment.reconcileRevision(currentComment, response, { kind: "resolve" }),
  ).toMatchObject({ ok: false, error: { reason: "bodyMismatch" } });
});

test("Comment.reconcileRevisionはanchorをfield-wiseで比較する", () => {
  const equivalentAnchor = createCommentAnchorTestFixture({
    fileKey: currentComment.anchor.fileKey,
    blockType: currentComment.anchor.blockType,
    blockIndex: currentComment.anchor.blockIndex,
    textHash: currentComment.anchor.textHash,
    textSnippet: currentComment.anchor.textSnippet,
    charRange: { ...currentComment.anchor.charRange },
  });
  const response = createUpdateResponse({ anchor: equivalentAnchor });

  expect(
    Comment.reconcileRevision(currentComment, response, updateExpectation),
  ).toMatchObject({ ok: true });
});

/**
 * @param overrides - Response fields that differ from a valid body update.
 * @returns A valid aggregate shaped as an update response.
 */
function createUpdateResponse(overrides: CommentTestFixtureInput = {}) {
  return createCommentTestFixture({
    body: "Updated body",
    updatedAt: "2026-05-05T10:15:00Z",
    ...overrides,
  });
}
