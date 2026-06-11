import { expect, test } from "vitest";

import {
  CommentOperationEvent,
  CommentOperationIdleState,
} from "@/features/comments/domain/commentOperation";
import { CommentId } from "@/features/comments/types/comment";
import type { NormalizedCommandError } from "@/shared/types/ipc";

const commandError: NormalizedCommandError = {
  code: "commentRepository",
  message: "Comment operation failed.",
  raw: "Comment operation failed.",
};

const idleState = CommentOperationIdleState.create();

test("reduceはoperationStartedで保存中状態へ遷移する", () => {
  const nextState = CommentOperationEvent.reduce(idleState, {
    type: "operationStarted",
    operation: "update",
    commentId: CommentId.fromString("comment-1"),
  });

  expect(nextState).toEqual({
    status: "saving",
    operation: "update",
    commentId: "comment-1",
    error: null,
  });
});

test.each([
  ["operationSucceeded"],
  ["operationInvalidated"],
] as const)("reduceは%sでidle状態へ戻す", (type) => {
  const savingState = CommentOperationEvent.reduce(idleState, {
    type: "operationStarted",
    operation: "delete",
    commentId: CommentId.fromString("comment-1"),
  });

  expect(CommentOperationEvent.reduce(savingState, { type })).toEqual(
    idleState,
  );
});

test("reduceはoperationFailedで失敗した操作とエラーを保持する", () => {
  const nextState = CommentOperationEvent.reduce(idleState, {
    type: "operationFailed",
    operation: "add",
    commentId: null,
    error: commandError,
  });

  expect(nextState).toEqual({
    status: "error",
    operation: "add",
    commentId: null,
    error: commandError,
  });
});
