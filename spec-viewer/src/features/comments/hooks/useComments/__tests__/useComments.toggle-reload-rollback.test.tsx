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
import type {
  Comment,
  ListCommentsResponse,
} from "@/features/comments/types/comment";

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
const thirdComment = createCommentTestFixture({
  id: "cmt_3",
  body: "Third comment",
});

test("useCommentsはtoggle待機中のreload結果を失敗rollbackで失わない", async () => {
  const toggleDeferred = createDeferred<Comment>();
  const listComments = vi
    .fn()
    .mockResolvedValueOnce({ comments: [firstComment, secondComment] })
    .mockResolvedValueOnce({
      comments: [firstComment, updatedSecondComment, thirdComment],
    });
  const base = createCommentCommandTestDouble();
  const commands = {
    ...base.commands,
    listComments,
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
    await result.current.reloadComments();
  });
  toggleDeferred.reject("toggle failed");
  await act(async () => {
    await expect(togglePromise).resolves.toBeNull();
  });

  expect(result.current.comments).toEqual([
    firstComment,
    updatedSecondComment,
    thirdComment,
  ]);
  result.unmount();
});

test("useCommentsはtargetを欠くreload後に古いtoggle対象を復活させない", async () => {
  const toggleDeferred = createDeferred<Comment>();
  const reloadDeferred = createDeferred<ListCommentsResponse>();
  const listComments = vi
    .fn()
    .mockResolvedValueOnce({ comments: [firstComment, secondComment] })
    .mockReturnValueOnce(reloadDeferred.promise);
  const base = createCommentCommandTestDouble();
  const commands = {
    ...base.commands,
    listComments,
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
  let reloadPromise: Promise<boolean> = Promise.resolve(false);
  act(() => {
    reloadPromise = result.current.reloadComments();
  });

  await act(async () => {
    reloadDeferred.resolve({ comments: [updatedSecondComment, thirdComment] });
    await Promise.resolve();
    await Promise.resolve();
    toggleDeferred.reject("toggle failed");
    await expect(reloadPromise).resolves.toBe(true);
    await expect(togglePromise).resolves.toBeNull();
  });

  expect(result.current.comments).toEqual([updatedSecondComment, thirdComment]);
  result.unmount();
});
