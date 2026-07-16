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
const secondComment = createCommentTestFixture({
  id: "cmt_2",
  body: "Second comment",
});
const thirdComment = createCommentTestFixture({
  id: "cmt_3",
  body: "Third comment",
});
const updatedFirstComment = createCommentTestFixture({
  id: "cmt_1",
  body: "Updated first comment",
  updatedAt: "2026-05-05T10:15:00Z",
});

test("useCommentsはdelete reload中の別comment updateで無関係commentを失わない", async () => {
  const deleteDeferred = createDeferred<{ deleted: boolean }>();
  const updateDeferred = createDeferred<Comment>();
  const reloadDeferred = createDeferred<ListCommentsResponse>();
  const listComments = vi
    .fn()
    .mockResolvedValueOnce({
      comments: [firstComment, secondComment, thirdComment],
    })
    .mockReturnValueOnce(reloadDeferred.promise);
  const base = createCommentCommandTestDouble();
  const commands = {
    ...base.commands,
    listComments,
    deleteComment: vi.fn().mockReturnValue(deleteDeferred.promise),
    updateComment: vi.fn().mockReturnValue(updateDeferred.promise),
  };
  const result = renderUseComments({
    commands,
    scope: tasksScope,
    statusFilter: CommentStatusFilter.All,
  });
  await flushAsyncEffects();

  let deletePromise: Promise<boolean> = Promise.resolve(false);
  let updatePromise: Promise<Comment | null> = Promise.resolve(null);
  act(() => {
    deletePromise = result.current.deleteComment(secondComment.id);
    updatePromise = result.current.updateComment({
      commentId: firstComment.id,
      body: commentBody(updatedFirstComment.body),
    });
  });
  deleteDeferred.resolve({ deleted: true });
  await flushAsyncEffects();
  expect(result.current.isLoading).toBe(true);

  updateDeferred.resolve(updatedFirstComment);
  await act(async () => {
    await expect(updatePromise).resolves.toEqual(updatedFirstComment);
  });
  reloadDeferred.resolve({ comments: [updatedFirstComment, thirdComment] });
  await act(async () => {
    await expect(deletePromise).resolves.toBe(true);
  });

  expect(result.current.comments).toEqual([updatedFirstComment, thirdComment]);
  result.unmount();
});
