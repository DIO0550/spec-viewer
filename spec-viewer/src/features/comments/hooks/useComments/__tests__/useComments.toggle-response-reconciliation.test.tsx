import { act } from "react";
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
import type { Comment } from "@/features/comments/types/comment";

const openComment = createCommentTestFixture({ id: "cmt_1" });
const optimisticResolvedComment = createCommentTestFixture({
  id: "cmt_1",
  status: "resolved",
});
const resolvedComment = createCommentTestFixture({
  id: "cmt_1",
  status: "resolved",
  updatedAt: "2026-05-05T10:10:00Z",
});
const reopenedComment = createCommentTestFixture({
  id: "cmt_1",
  status: "open",
  updatedAt: "2026-05-05T10:20:00Z",
});

test("useCommentsは不正toggle responseを拒否して楽観更新を巻き戻す", async () => {
  const toggleDeferred = createDeferred<Comment>();
  const invalidResponse = createCommentTestFixture({
    id: "cmt_1",
    status: "open",
    updatedAt: "2026-05-05T10:10:00Z",
  });
  const base = createCommentCommandTestDouble({
    listComments: { comments: [openComment] },
  });
  const commands = {
    ...base.commands,
    toggleCommentResolved: vi.fn().mockReturnValue(toggleDeferred.promise),
  };
  const result = renderUseComments({
    commands,
    scope: tasksScope,
    statusFilter: CommentStatusFilter.All,
  });
  await flushAsyncEffects();

  let togglePromise: Promise<Comment | null> = Promise.resolve(null);
  act(() => {
    togglePromise = result.current.toggleCommentResolved(openComment.id);
  });
  expect(result.current.comments).toEqual([optimisticResolvedComment]);

  toggleDeferred.resolve(invalidResponse);
  await act(async () => {
    await expect(togglePromise).resolves.toBeNull();
  });

  expect(result.current.comments).toEqual([openComment]);
  expect(result.current.operationState).toMatchObject({
    status: "error",
    operation: "toggle",
    commentId: openComment.id,
    error: {
      code: "unknown",
      message: "Rejected toggle comment response: statusMismatch",
    },
  });
  result.unmount();
});

test.each([
  [CommentStatusFilter.Open, openComment, resolvedComment],
  [CommentStatusFilter.Resolved, resolvedComment, reopenedComment],
] as const)("useCommentsは%s filterのtoggleで対象が非表示になっても成功扱いにする", async (statusFilter, initialComment, responseComment) => {
  const toggleDeferred = createDeferred<Comment>();
  const base = createCommentCommandTestDouble({
    listComments: { comments: [initialComment] },
  });
  const commands = {
    ...base.commands,
    toggleCommentResolved: vi.fn().mockReturnValue(toggleDeferred.promise),
  };
  const result = renderUseComments({
    commands,
    scope: tasksScope,
    statusFilter,
  });
  await flushAsyncEffects();

  let togglePromise: Promise<Comment | null> = Promise.resolve(null);
  act(() => {
    togglePromise = result.current.toggleCommentResolved(initialComment.id);
  });
  expect(result.current.comments).toEqual([]);

  toggleDeferred.resolve(responseComment);
  await act(async () => {
    await expect(togglePromise).resolves.toEqual(responseComment);
  });

  expect(result.current.comments).toEqual([]);
  expect(result.current.operationState.status).toBe("idle");
  result.unmount();
});
