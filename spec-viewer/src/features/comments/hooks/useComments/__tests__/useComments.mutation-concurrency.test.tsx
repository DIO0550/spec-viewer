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
const resolvedFirstComment = createCommentTestFixture({
  id: "cmt_1",
  status: "resolved",
  updatedAt: "2026-05-05T10:10:00Z",
});
const updatedSecondComment = createCommentTestFixture({
  id: "cmt_2",
  body: "Updated second comment",
  updatedAt: "2026-05-05T10:15:00Z",
});
const firstUpdatedComment = createCommentTestFixture({
  id: "cmt_1",
  body: "First update",
  updatedAt: "2026-05-05T10:10:00Z",
});
const latestUpdatedComment = createCommentTestFixture({
  id: "cmt_1",
  body: "Latest update",
  updatedAt: "2026-05-05T10:20:00Z",
});

test("useCommentsは別commentの後発update中も先発resolve成功を反映する", async () => {
  const resolveDeferred = createDeferred<Comment>();
  const updateDeferred = createDeferred<Comment>();
  const base = createCommentCommandTestDouble({
    listComments: { comments: [firstComment, secondComment] },
  });
  const commands = {
    ...base.commands,
    resolveComment: vi.fn().mockReturnValue(resolveDeferred.promise),
    updateComment: vi.fn().mockReturnValue(updateDeferred.promise),
  };
  const result = renderUseComments({
    commands,
    scope: tasksScope,
    statusFilter: CommentStatusFilter.All,
  });
  await flushAsyncEffects();

  let resolvePromise: Promise<Comment | null> = Promise.resolve(null);
  let updatePromise: Promise<Comment | null> = Promise.resolve(null);
  act(() => {
    resolvePromise = result.current.resolveComment(firstComment.id);
    updatePromise = result.current.updateComment({
      commentId: secondComment.id,
      body: commentBody(updatedSecondComment.body),
    });
  });

  resolveDeferred.resolve(resolvedFirstComment);
  updateDeferred.resolve(updatedSecondComment);
  await act(async () => {
    await expect(Promise.all([resolvePromise, updatePromise])).resolves.toEqual(
      [resolvedFirstComment, updatedSecondComment],
    );
  });
  expect(result.current.comments).toEqual([
    resolvedFirstComment,
    updatedSecondComment,
  ]);
  expect(result.current.operationState.status).toBe("idle");
  result.unmount();
});

test("useCommentsは同じcommentの後発mutationだけを反映する", async () => {
  const firstUpdateDeferred = createDeferred<Comment>();
  const latestUpdateDeferred = createDeferred<Comment>();
  const base = createCommentCommandTestDouble({
    listComments: { comments: [firstComment] },
  });
  const commands = {
    ...base.commands,
    updateComment: vi
      .fn()
      .mockReturnValueOnce(firstUpdateDeferred.promise)
      .mockReturnValueOnce(latestUpdateDeferred.promise),
  };
  const result = renderUseComments({
    commands,
    scope: tasksScope,
    statusFilter: CommentStatusFilter.All,
  });
  await flushAsyncEffects();

  let firstUpdatePromise: Promise<Comment | null> = Promise.resolve(null);
  act(() => {
    firstUpdatePromise = result.current.updateComment({
      commentId: firstComment.id,
      body: commentBody(firstUpdatedComment.body),
    });
  });
  let latestUpdatePromise: Promise<Comment | null> = Promise.resolve(null);
  act(() => {
    latestUpdatePromise = result.current.updateComment({
      commentId: firstComment.id,
      body: commentBody(latestUpdatedComment.body),
    });
  });

  latestUpdateDeferred.resolve(latestUpdatedComment);
  await act(async () => {
    await expect(latestUpdatePromise).resolves.toEqual(latestUpdatedComment);
  });
  expect(result.current.comments).toEqual([latestUpdatedComment]);

  firstUpdateDeferred.resolve(firstUpdatedComment);
  await act(async () => {
    await expect(firstUpdatePromise).resolves.toBeNull();
  });
  expect(result.current.comments).toEqual([latestUpdatedComment]);
  expect(result.current.operationState.status).toBe("idle");
  result.unmount();
});
