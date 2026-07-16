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
const reloadedFirstComment = createCommentTestFixture({
  id: "cmt_1",
  anchorResolution: {
    status: "moved",
    reason: "moved_by_hash",
    details: "Moved to a nearby block.",
    target: null,
  },
});
const secondComment = createCommentTestFixture({
  id: "cmt_2",
  body: "Second comment",
});

test("useCommentsはID未採番のconcurrent addを両方反映する", async () => {
  const firstAddDeferred = createDeferred<Comment>();
  const secondAddDeferred = createDeferred<Comment>();
  const base = createCommentCommandTestDouble({
    listComments: { comments: [] },
  });
  const commands = {
    ...base.commands,
    addComment: vi
      .fn()
      .mockReturnValueOnce(firstAddDeferred.promise)
      .mockReturnValueOnce(secondAddDeferred.promise),
  };
  const result = renderUseComments({
    commands,
    scope: tasksScope,
    statusFilter: CommentStatusFilter.All,
  });
  await flushAsyncEffects();

  let firstAddPromise: Promise<Comment | null> = Promise.resolve(null);
  let secondAddPromise: Promise<Comment | null> = Promise.resolve(null);
  act(() => {
    firstAddPromise = result.current.addComment({
      anchor: firstComment.anchor,
      body: commentBody(firstComment.body),
    });
    secondAddPromise = result.current.addComment({
      anchor: secondComment.anchor,
      body: commentBody(secondComment.body),
    });
  });

  firstAddDeferred.resolve(firstComment);
  secondAddDeferred.resolve(secondComment);
  await act(async () => {
    await expect(
      Promise.all([firstAddPromise, secondAddPromise]),
    ).resolves.toEqual([firstComment, secondComment]);
  });
  expect(result.current.comments).toEqual([firstComment, secondComment]);
  expect(result.current.operationState.status).toBe("idle");
  result.unmount();
});

test("useCommentsはadd応答前のreloadで同一aggregateが入っても冪等成功する", async () => {
  const addDeferred = createDeferred<Comment>();
  const reloadDeferred = createDeferred<ListCommentsResponse>();
  const base = createCommentCommandTestDouble({
    listComments: { comments: [] },
  });
  const commands = {
    ...base.commands,
    listComments: vi
      .fn()
      .mockResolvedValueOnce({ comments: [] })
      .mockReturnValueOnce(reloadDeferred.promise),
    addComment: vi.fn().mockReturnValue(addDeferred.promise),
  };
  const result = renderUseComments({
    commands,
    scope: tasksScope,
    statusFilter: CommentStatusFilter.All,
  });
  await flushAsyncEffects();

  let addPromise: Promise<Comment | null> = Promise.resolve(null);
  act(() => {
    addPromise = result.current.addComment({
      anchor: firstComment.anchor,
      body: commentBody(firstComment.body),
    });
  });
  let reloadPromise: Promise<boolean> = Promise.resolve(false);
  act(() => {
    reloadPromise = result.current.reloadComments();
  });
  reloadDeferred.resolve({ comments: [reloadedFirstComment] });
  await act(async () => {
    await expect(reloadPromise).resolves.toBe(true);
  });

  addDeferred.resolve(firstComment);
  await act(async () => {
    await expect(addPromise).resolves.toEqual(reloadedFirstComment);
  });
  expect(result.current.comments).toEqual([reloadedFirstComment]);
  expect(result.current.operationState.status).toBe("idle");
  result.unmount();
});
