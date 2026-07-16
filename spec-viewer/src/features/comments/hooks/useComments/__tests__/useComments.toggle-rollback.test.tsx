import { act } from "react";
import { expect, test, vi } from "vitest";
import { CommentStatusFilter } from "@/features/comments/domain/commentStatusFilter";
import {
  createDeferred,
  flushAsyncEffects,
  renderUseComments,
  tasksScope,
} from "@/features/comments/hooks/useComments/__tests__/useComments.concurrent.fixture";
import { commentBody } from "@/features/comments/testing/comment-body-test-fixture";
import { createCommentCommandTestDouble } from "@/features/comments/testing/comment-command-test-double";
import { createCommentTestFixture } from "@/features/comments/testing/comment-test-fixture";
import type { Comment } from "@/features/comments/types/comment";

const firstComment = createCommentTestFixture({ id: "cmt_1" });
const secondComment = createCommentTestFixture({
  id: "cmt_2",
  body: "Second comment",
});
const updatedSecondComment = createCommentTestFixture({
  id: "cmt_2",
  body: "Updated second comment",
  updatedAt: "2026-05-05T10:15:00Z",
});

test("useCommentsはlocal optimistic emptyをreload扱いせずrollbackする", async () => {
  const toggleDeferred = createDeferred<Comment>();
  const base = createCommentCommandTestDouble({
    listComments: { comments: [firstComment] },
  });
  const commands = {
    ...base.commands,
    toggleCommentResolved: vi.fn().mockReturnValue(toggleDeferred.promise),
  };
  const result = renderUseComments({
    commands,
    scope: tasksScope,
    statusFilter: CommentStatusFilter.Open,
  });
  await flushAsyncEffects();

  let togglePromise: Promise<Comment | null> = Promise.resolve(null);
  act(() => {
    togglePromise = result.current.toggleCommentResolved(firstComment.id);
  });
  expect(result.current.comments).toEqual([]);
  toggleDeferred.reject("toggle failed");
  await act(async () => {
    await expect(togglePromise).resolves.toBeNull();
  });

  expect(result.current.comments).toEqual([firstComment]);
  result.unmount();
});

test("useCommentsは別comment操作後のtoggle失敗で対象だけを再表示する", async () => {
  const toggleDeferred = createDeferred<Comment>();
  const base = createCommentCommandTestDouble({
    listComments: { comments: [firstComment, secondComment] },
    updateComment: updatedSecondComment,
  });
  const commands = {
    ...base.commands,
    toggleCommentResolved: vi.fn().mockReturnValue(toggleDeferred.promise),
  };
  const result = renderUseComments({
    commands,
    scope: tasksScope,
    statusFilter: CommentStatusFilter.Open,
  });
  await flushAsyncEffects();

  let togglePromise: Promise<Comment | null> = Promise.resolve(null);
  act(() => {
    togglePromise = result.current.toggleCommentResolved(firstComment.id);
  });
  expect(result.current.comments).toEqual([secondComment]);
  await act(async () => {
    await result.current.updateComment({
      commentId: secondComment.id,
      body: commentBody(updatedSecondComment.body),
    });
  });

  toggleDeferred.reject("toggle failed");
  await act(async () => {
    await expect(togglePromise).resolves.toBeNull();
  });
  expect(result.current.comments).toEqual([firstComment, updatedSecondComment]);
  expect(result.current.operationState.status).toBe("idle");
  result.unmount();
});

test("useCommentsは同じcommentの後発operationを古いtoggle失敗で戻さない", async () => {
  const toggleDeferred = createDeferred<Comment>();
  const reopenedComment = createCommentTestFixture({
    id: firstComment.id,
    status: "open",
    updatedAt: "2026-05-05T10:20:00Z",
  });
  const base = createCommentCommandTestDouble({
    listComments: { comments: [firstComment] },
    reopenComment: reopenedComment,
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
    togglePromise = result.current.toggleCommentResolved(firstComment.id);
  });
  await act(async () => {
    await result.current.reopenComment(firstComment.id);
  });
  toggleDeferred.reject("toggle failed");
  await act(async () => {
    await expect(togglePromise).resolves.toBeNull();
  });

  expect(result.current.comments).toEqual([reopenedComment]);
  result.unmount();
});
