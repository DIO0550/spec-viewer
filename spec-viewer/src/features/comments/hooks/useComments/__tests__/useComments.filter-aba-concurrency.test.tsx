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
import type {
  Comment,
  ListCommentsResponse,
} from "@/features/comments/types/comment";

const firstComment = createCommentTestFixture({ id: "cmt_1" });
const secondComment = createCommentTestFixture({ id: "cmt_2" });
const staleUpdatedComment = createCommentTestFixture({
  id: "cmt_1",
  body: "Stale update",
  updatedAt: "2026-05-05T10:10:00Z",
});
const authoritativeFirstComment = createCommentTestFixture({
  id: "cmt_1",
  body: "Authoritative update",
  updatedAt: "2026-05-05T10:20:00Z",
});

test("useCommentsはfilter ABA後に旧mutationで最新reloadをcancelしない", async () => {
  const updateDeferred = createDeferred<Comment>();
  const resolvedReloadDeferred = createDeferred<ListCommentsResponse>();
  const reenteredOpenReloadDeferred = createDeferred<ListCommentsResponse>();
  const latestOpenReloadDeferred = createDeferred<ListCommentsResponse>();
  const listComments = vi
    .fn()
    .mockResolvedValueOnce({ comments: [firstComment, secondComment] })
    .mockReturnValueOnce(resolvedReloadDeferred.promise)
    .mockReturnValueOnce(reenteredOpenReloadDeferred.promise)
    .mockReturnValueOnce(latestOpenReloadDeferred.promise);
  const base = createCommentCommandTestDouble();
  const commands = {
    ...base.commands,
    listComments,
    updateComment: vi.fn().mockReturnValue(updateDeferred.promise),
  };
  const result = renderUseComments({
    commands,
    scope: tasksScope,
    statusFilter: CommentStatusFilter.Open,
  });
  await flushAsyncEffects();

  let updatePromise: Promise<Comment | null> = Promise.resolve(null);
  act(() => {
    updatePromise = result.current.updateComment({
      commentId: firstComment.id,
      body: commentBody(staleUpdatedComment.body),
    });
  });
  result.rerender({
    commands,
    scope: tasksScope,
    statusFilter: CommentStatusFilter.Resolved,
  });
  result.rerender({
    commands,
    scope: tasksScope,
    statusFilter: CommentStatusFilter.Open,
  });

  updateDeferred.resolve(staleUpdatedComment);
  await flushAsyncEffects();

  const authoritativeComments = [authoritativeFirstComment, secondComment];
  resolvedReloadDeferred.resolve({ comments: [] });
  reenteredOpenReloadDeferred.resolve({ comments: authoritativeComments });
  latestOpenReloadDeferred.resolve({ comments: authoritativeComments });
  await act(async () => {
    await expect(updatePromise).resolves.toEqual(staleUpdatedComment);
  });

  const finalComments = result.current.comments;
  const listCallCount = listComments.mock.calls.length;
  result.unmount();
  expect(finalComments).toEqual(authoritativeComments);
  expect(listCallCount).toBe(4);
});
