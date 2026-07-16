import { act } from "react";
import { expect, test } from "vitest";
import { CommentStatusFilter } from "@/features/comments/domain/commentStatusFilter";
import {
  flushAsyncEffects,
  renderUseComments,
  tasksScope,
} from "@/features/comments/hooks/useComments/__tests__/useComments.concurrent.fixture";
import { commentBody } from "@/features/comments/testing/comment-body-test-fixture";
import { createCommentCommandTestDouble } from "@/features/comments/testing/comment-command-test-double";
import { createCommentTestFixture } from "@/features/comments/testing/comment-test-fixture";

const firstComment = createCommentTestFixture({ id: "cmt_1" });

test("useCommentsはbodyが異なるadd responseを拒否する", async () => {
  const requestedBody = commentBody("Requested body");
  const invalidResponse = createCommentTestFixture({
    body: "Unexpected body",
  });
  const double = createCommentCommandTestDouble({
    listComments: { comments: [] },
    addComment: invalidResponse,
  });
  const result = renderUseComments({
    commands: double.commands,
    scope: tasksScope,
    statusFilter: CommentStatusFilter.All,
  });
  await flushAsyncEffects();

  await act(async () => {
    await expect(
      result.current.addComment({
        anchor: invalidResponse.anchor,
        body: requestedBody,
      }),
    ).resolves.toBeNull();
  });

  expect(result.current.comments).toEqual([]);
  expect(result.current.operationState).toMatchObject({
    status: "error",
    operation: "add",
    commentId: null,
    error: {
      code: "unknown",
      message: "Rejected add comment response: bodyMismatch",
    },
  });
  result.unmount();
});

test("useCommentsは期待IDと異なるupdate responseを拒否する", async () => {
  const mismatchedResponse = createCommentTestFixture({
    id: "cmt_other",
    body: "Updated body",
    updatedAt: "2026-05-05T10:15:00Z",
  });
  const double = createCommentCommandTestDouble({
    listComments: { comments: [firstComment] },
    updateComment: mismatchedResponse,
  });
  const result = renderUseComments({
    commands: double.commands,
    scope: tasksScope,
    statusFilter: CommentStatusFilter.All,
  });
  await flushAsyncEffects();

  await act(async () => {
    await expect(
      result.current.updateComment({
        commentId: firstComment.id,
        body: commentBody("Updated body"),
      }),
    ).resolves.toBeNull();
  });

  expect(result.current.comments).toEqual([firstComment]);
  expect(result.current.operationState).toMatchObject({
    status: "error",
    operation: "update",
    commentId: firstComment.id,
    error: {
      code: "unknown",
      message: "Rejected update comment response: commentIdMismatch",
    },
  });
  result.unmount();
});

test("useCommentsはcurrentより古いupdate responseを拒否する", async () => {
  const currentComment = createCommentTestFixture({
    body: "Current body",
    updatedAt: "2026-05-05T10:15:00Z",
  });
  const staleResponse = createCommentTestFixture({
    body: "Stale body",
    updatedAt: "2026-05-05T10:10:00Z",
  });
  const double = createCommentCommandTestDouble({
    listComments: { comments: [currentComment] },
    updateComment: staleResponse,
  });
  const result = renderUseComments({
    commands: double.commands,
    scope: tasksScope,
    statusFilter: CommentStatusFilter.All,
  });
  await flushAsyncEffects();

  await act(async () => {
    await expect(
      result.current.updateComment({
        commentId: currentComment.id,
        body: commentBody(staleResponse.body),
      }),
    ).resolves.toBeNull();
  });

  expect(result.current.comments).toEqual([currentComment]);
  expect(result.current.operationState).toMatchObject({
    status: "error",
    operation: "update",
    error: {
      message:
        "Rejected update comment response: updatedAtBeforePreviousUpdate",
    },
  });
  result.unmount();
});

test("useCommentsはopenのまま返るresolve responseを拒否する", async () => {
  const invalidResponse = createCommentTestFixture({
    status: "open",
    updatedAt: "2026-05-05T10:10:00Z",
  });
  const double = createCommentCommandTestDouble({
    listComments: { comments: [firstComment] },
    resolveComment: invalidResponse,
  });
  const result = renderUseComments({
    commands: double.commands,
    scope: tasksScope,
    statusFilter: CommentStatusFilter.All,
  });
  await flushAsyncEffects();

  await act(async () => {
    await expect(
      result.current.resolveComment(firstComment.id),
    ).resolves.toBeNull();
  });

  expect(result.current.comments).toEqual([firstComment]);
  expect(result.current.operationState).toMatchObject({
    status: "error",
    operation: "resolve",
    error: {
      message: "Rejected resolve comment response: statusMismatch",
    },
  });
  result.unmount();
});
