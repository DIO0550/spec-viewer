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
const thirdComment = createCommentTestFixture({ id: "cmt_3" });
const requestedUpdate = createCommentTestFixture({
  id: "cmt_1",
  body: "Requested update",
  updatedAt: "2026-05-05T10:10:00Z",
});
const reloadedNewerComment = createCommentTestFixture({
  id: "cmt_1",
  body: "Reloaded newer update",
  updatedAt: "2026-05-05T10:20:00Z",
});
const reloadedSecondComment = createCommentTestFixture({
  id: "cmt_2",
  body: "Reloaded second comment",
  updatedAt: "2026-05-05T10:20:00Z",
});
const anchorResolution = {
  status: "moved",
  reason: "moved_by_hash",
  details: "Moved to a nearby block.",
  target: null,
} as const;
const anchoredComment = createCommentTestFixture({ anchorResolution });
const anchoredUpdate = createCommentTestFixture({
  body: "Updated anchored comment",
  updatedAt: "2026-05-05T10:10:00Z",
});

test("useCommentsは同tickのreloadより古いrevision responseを拒否する", async () => {
  const updateDeferred = createDeferred<Comment>();
  const reloadDeferred = createDeferred<ListCommentsResponse>();
  const listComments = vi
    .fn()
    .mockResolvedValueOnce({ comments: [firstComment, secondComment] })
    .mockReturnValueOnce(reloadDeferred.promise);
  const base = createCommentCommandTestDouble();
  const commands = {
    ...base.commands,
    listComments,
    updateComment: vi.fn().mockReturnValue(updateDeferred.promise),
  };
  const result = renderUseComments({
    commands,
    scope: tasksScope,
    statusFilter: CommentStatusFilter.All,
  });
  await flushAsyncEffects();

  let updatePromise: Promise<Comment | null> = Promise.resolve(null);
  act(() => {
    updatePromise = result.current.updateComment({
      commentId: firstComment.id,
      body: commentBody(requestedUpdate.body),
    });
  });
  let reloadPromise: Promise<boolean> = Promise.resolve(false);
  act(() => {
    reloadPromise = result.current.reloadComments();
  });

  const authoritativeComments = [
    reloadedNewerComment,
    reloadedSecondComment,
    thirdComment,
  ];
  await act(async () => {
    reloadDeferred.resolve({ comments: authoritativeComments });
    await expect(reloadPromise).resolves.toBe(true);
    updateDeferred.resolve(requestedUpdate);
    await expect(updatePromise).resolves.toBeNull();
  });

  expect(result.current.comments).toEqual(authoritativeComments);
  result.unmount();
});

test("useCommentsはreloadでtarget不在でもanchor resolutionを維持する", async () => {
  const updateDeferred = createDeferred<Comment>();
  const listComments = vi
    .fn()
    .mockResolvedValueOnce({ comments: [anchoredComment] })
    .mockResolvedValueOnce({ comments: [] });
  const base = createCommentCommandTestDouble();
  const commands = {
    ...base.commands,
    listComments,
    updateComment: vi.fn().mockReturnValue(updateDeferred.promise),
  };
  const result = renderUseComments({
    commands,
    scope: tasksScope,
    statusFilter: CommentStatusFilter.All,
  });
  await flushAsyncEffects();

  let updatePromise: Promise<Comment | null> = Promise.resolve(null);
  act(() => {
    updatePromise = result.current.updateComment({
      commentId: anchoredComment.id,
      body: commentBody(anchoredUpdate.body),
    });
  });
  await act(async () => {
    await result.current.reloadComments();
  });

  updateDeferred.resolve(anchoredUpdate);
  await act(async () => {
    await expect(updatePromise).resolves.toEqual({
      ...anchoredUpdate,
      anchorResolution,
    });
  });
  expect(result.current.comments).toEqual([
    { ...anchoredUpdate, anchorResolution },
  ]);
  result.unmount();
});
