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
const resolvedComment = createCommentTestFixture({
  id: "cmt_1",
  status: "resolved",
  updatedAt: "2026-05-05T10:10:00Z",
});

test("useCommentsはfilter変更中に成功したmutation後に現在filterを再取得する", async () => {
  const resolveDeferred = createDeferred<Comment>();
  const listComments = vi
    .fn()
    .mockResolvedValueOnce({ comments: [openComment] })
    .mockResolvedValueOnce({ comments: [] })
    .mockResolvedValueOnce({ comments: [resolvedComment] });
  const base = createCommentCommandTestDouble();
  const commands = {
    ...base.commands,
    listComments,
    resolveComment: vi.fn().mockReturnValue(resolveDeferred.promise),
  };
  const result = renderUseComments({
    commands,
    scope: tasksScope,
    statusFilter: CommentStatusFilter.Open,
  });
  await flushAsyncEffects();

  let resolvePromise: Promise<Comment | null> = Promise.resolve(null);
  act(() => {
    resolvePromise = result.current.resolveComment(openComment.id);
  });
  result.rerender({
    commands,
    scope: tasksScope,
    statusFilter: CommentStatusFilter.Resolved,
  });
  await flushAsyncEffects();
  expect(result.current.comments).toEqual([]);

  resolveDeferred.resolve(resolvedComment);
  await act(async () => {
    await expect(resolvePromise).resolves.toEqual(resolvedComment);
  });

  expect(result.current.comments).toEqual([resolvedComment]);
  expect(listComments).toHaveBeenCalledTimes(3);
  expect(result.current.operationState.status).toBe("idle");
  result.unmount();
});

test("useCommentsはfilter変更前のmutation失敗を現在UIに表示しない", async () => {
  const resolveDeferred = createDeferred<Comment>();
  const listComments = vi
    .fn()
    .mockResolvedValueOnce({ comments: [openComment] })
    .mockResolvedValueOnce({ comments: [] });
  const base = createCommentCommandTestDouble();
  const commands = {
    ...base.commands,
    listComments,
    resolveComment: vi.fn().mockReturnValue(resolveDeferred.promise),
  };
  const result = renderUseComments({
    commands,
    scope: tasksScope,
    statusFilter: CommentStatusFilter.Open,
  });
  await flushAsyncEffects();

  let resolvePromise: Promise<Comment | null> = Promise.resolve(null);
  act(() => {
    resolvePromise = result.current.resolveComment(openComment.id);
  });
  result.rerender({
    commands,
    scope: tasksScope,
    statusFilter: CommentStatusFilter.Resolved,
  });
  await flushAsyncEffects();

  resolveDeferred.reject("resolve failed");
  await act(async () => {
    await expect(resolvePromise).resolves.toBeNull();
  });

  expect(result.current.comments).toEqual([]);
  expect(result.current.operationState.status).toBe("idle");
  expect(listComments).toHaveBeenCalledTimes(2);
  result.unmount();
});
