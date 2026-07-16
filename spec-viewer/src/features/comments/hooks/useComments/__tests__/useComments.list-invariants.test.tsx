import { expect, test, vi } from "vitest";
import { CommentStatusFilter } from "@/features/comments/domain/commentStatusFilter";
import {
  createDeferred,
  flushAsyncEffects,
  renderUseComments,
  tasksScope,
} from "@/features/comments/hooks/useComments/__tests__/useComments.concurrent.fixture";
import { createCommentCommandTestDouble } from "@/features/comments/testing/comment-command-test-double";
import { createCommentTestFixture } from "@/features/comments/testing/comment-test-fixture";
import type { ListCommentsResponse } from "@/features/comments/types/comment";
import { configurePerformanceLoggerForTest } from "@/shared/lib/performance";

const openComment = createCommentTestFixture({ id: "cmt_1" });
const duplicateOpenComment = createCommentTestFixture({
  id: openComment.id,
  body: "Duplicate identity",
});
const resolvedComment = createCommentTestFixture({
  id: "cmt_2",
  status: "resolved",
  updatedAt: "2026-05-05T10:10:00Z",
});

test("useCommentsは重複IDを含むlist responseをerrorにする", async () => {
  const double = createCommentCommandTestDouble({
    listComments: { comments: [openComment, duplicateOpenComment] },
  });
  const result = renderUseComments({
    commands: double.commands,
    scope: tasksScope,
    statusFilter: CommentStatusFilter.All,
  });
  await flushAsyncEffects();

  expect(result.current.listState).toMatchObject({
    status: "error",
    error: {
      code: "invalidComment",
      domainError: { reason: "commentRejected" },
      cause: {
        reason: "duplicateCommentId",
        commentId: openComment.id,
      },
    },
  });
  result.unmount();
});

test.each([
  ["valid", [openComment], { commentCount: 1 }],
  ["invalid", [openComment, duplicateOpenComment], { error: true }],
] as const)("useCommentsは%s list responseのperformance spanを一度だけ記録する", async (_label, comments, expectedMetadata) => {
  configurePerformanceLoggerForTest(true);
  const debugSpy = vi
    .spyOn(console, "debug")
    .mockImplementation(() => undefined);
  const double = createCommentCommandTestDouble({
    listComments: { comments },
  });
  const result = renderUseComments({
    commands: double.commands,
    scope: tasksScope,
    statusFilter: CommentStatusFilter.All,
  });

  try {
    await flushAsyncEffects();

    expect(debugSpy).toHaveBeenCalledTimes(1);
    expect(debugSpy).toHaveBeenCalledWith(
      "[spec-viewer:perf]",
      expect.objectContaining({
        type: "span",
        phase: "comments.list",
        metadata: expect.objectContaining(expectedMetadata),
      }),
    );
  } finally {
    result.unmount();
    debugSpy.mockRestore();
    configurePerformanceLoggerForTest(null);
  }
});

test.each([
  [CommentStatusFilter.Open, resolvedComment],
  [CommentStatusFilter.Resolved, openComment],
] as const)("useCommentsは%s filter対象外のlist responseをerrorにする", async (statusFilter, comment) => {
  const double = createCommentCommandTestDouble({
    listComments: { comments: [comment] },
  });
  const result = renderUseComments({
    commands: double.commands,
    scope: tasksScope,
    statusFilter,
  });
  await flushAsyncEffects();

  expect(result.current.listState).toMatchObject({
    status: "error",
    error: {
      code: "invalidComment",
      domainError: { reason: "commentRejected" },
      cause: {
        reason: "statusFilterMismatch",
        commentId: comment.id,
      },
    },
  });
  result.unmount();
});

test("useCommentsは古いfilter requestの不正responseをactive一覧へ適用しない", async () => {
  const staleList = createDeferred<ListCommentsResponse>();
  const baseCommands = createCommentCommandTestDouble().commands;
  const commands = {
    ...baseCommands,
    listComments: vi
      .fn()
      .mockReturnValueOnce(staleList.promise)
      .mockResolvedValueOnce({ comments: [resolvedComment] }),
  };
  const result = renderUseComments({
    commands,
    scope: tasksScope,
    statusFilter: CommentStatusFilter.Open,
  });
  await flushAsyncEffects();

  result.rerender({
    commands,
    scope: tasksScope,
    statusFilter: CommentStatusFilter.Resolved,
  });
  await flushAsyncEffects();
  staleList.resolve({ comments: [resolvedComment] });
  await flushAsyncEffects();

  expect(result.current.listState.status).toBe("ready");
  expect(result.current.comments).toEqual([resolvedComment]);
  expect(result.current.error).toBeNull();
  result.unmount();
});
