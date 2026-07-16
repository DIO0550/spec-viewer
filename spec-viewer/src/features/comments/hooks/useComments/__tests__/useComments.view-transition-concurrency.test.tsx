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
import type { ListCommentsResponse } from "@/features/comments/types/comment";

const openComment = createCommentTestFixture({ id: "cmt_1" });
const addedOpenComment = createCommentTestFixture({
  id: "cmt_2",
  body: "Added while resolved comments load",
});
const resolvedFilterComment = createCommentTestFixture({
  id: "cmt_3",
  status: "resolved",
});

test("useCommentsはfilter変更後のmutationへ旧filterのcommentsを混ぜない", async () => {
  const resolvedListDeferred = createDeferred<ListCommentsResponse>();
  const listComments = vi
    .fn()
    .mockResolvedValueOnce({ comments: [openComment] })
    .mockReturnValueOnce(resolvedListDeferred.promise);
  const base = createCommentCommandTestDouble({
    addComment: addedOpenComment,
  });
  const commands = { ...base.commands, listComments };
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
  expect(result.current.isLoading).toBe(true);

  await act(async () => {
    await result.current.addComment({
      anchor: addedOpenComment.anchor,
      body: commentBody(addedOpenComment.body),
    });
  });
  expect(result.current.comments).toEqual([]);

  resolvedListDeferred.resolve({ comments: [resolvedFilterComment] });
  await act(async () => {
    await resolvedListDeferred.promise;
  });
  expect(result.current.comments).toEqual([resolvedFilterComment]);
  expect(listComments).toHaveBeenCalledTimes(2);
  result.unmount();
});
