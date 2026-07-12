import { expect, test } from "vitest";

import * as commentOperationModule from "@/features/comments/domain/commentOperation";
import {
  CommentOperationFailedState,
  CommentOperationIdleState,
  CommentOperationSavingState,
  type CommentOperationState,
} from "@/features/comments/domain/commentOperation";
import { CommentId } from "@/features/comments/types/comment";
import { AddCommentCommandError } from "@/features/comments/infra/tauri/addComment";
import type { CommentFeatureError } from "@/features/comments/domain/commentError";

const commentId = CommentId.fromString;

const commandError = AddCommentCommandError.fromUnknown({
  code: "commentRepository",
  message: "Comment operation failed.",
});

const featureError: CommentFeatureError = {
  feature: "comments",
  code: "commentRepository",
  message: "Comment operation failed.",
  cause: commandError,
};

test("CommentOperationIdleState.createは操作していない状態を生成する", () => {
  expect(CommentOperationIdleState.create()).toEqual({
    status: "idle",
    operation: null,
    commentId: null,
    error: null,
  });
});

test("CommentOperationSavingState.createは保存中の操作種別と対象コメントを保持する", () => {
  expect(
    CommentOperationSavingState.create("update", commentId("cmt_target")),
  ).toEqual({
    status: "saving",
    operation: "update",
    commentId: commentId("cmt_target"),
    error: null,
  });
});

test("CommentOperationFailedState.createは失敗した操作種別とエラーを保持する", () => {
  expect(
    CommentOperationFailedState.create(
      "delete",
      commentId("cmt_target"),
      featureError,
    ),
  ).toEqual({
    status: "error",
    operation: "delete",
    commentId: commentId("cmt_target"),
    error: featureError,
  });
});

test("CommentOperationIdleState.isはidle状態だけを判定する", () => {
  const idleState: CommentOperationState = CommentOperationIdleState.create();
  const savingState: CommentOperationState = CommentOperationSavingState.create(
    "add",
    null,
  );

  expect(CommentOperationIdleState.is(idleState)).toBe(true);
  expect(CommentOperationIdleState.is(savingState)).toBe(false);
});

test("CommentOperationSavingState.isはsaving状態だけを判定する", () => {
  const savingState: CommentOperationState = CommentOperationSavingState.create(
    "resolve",
    commentId("cmt_target"),
  );
  const failedState: CommentOperationState = CommentOperationFailedState.create(
    "resolve",
    commentId("cmt_target"),
    featureError,
  );

  expect(CommentOperationSavingState.is(savingState)).toBe(true);
  expect(CommentOperationSavingState.is(failedState)).toBe(false);
});

test("CommentOperationFailedState.isはerror状態だけを判定する", () => {
  const failedState: CommentOperationState = CommentOperationFailedState.create(
    "toggle",
    commentId("cmt_target"),
    featureError,
  );
  const idleState: CommentOperationState = CommentOperationIdleState.create();

  expect(CommentOperationFailedState.is(failedState)).toBe(true);
  expect(CommentOperationFailedState.is(idleState)).toBe(false);
});

test("CommentOperationSavingState.matchesOperationは保存中の操作種別一致を判定する", () => {
  const state: CommentOperationState = CommentOperationSavingState.create(
    "add",
    null,
  );

  expect(CommentOperationSavingState.matchesOperation(state, "add")).toBe(true);
  expect(CommentOperationSavingState.matchesOperation(state, "update")).toBe(
    false,
  );
  expect(
    CommentOperationSavingState.matchesOperation(
      CommentOperationIdleState.create(),
      "add",
    ),
  ).toBe(false);
});

test("CommentOperationSavingState.isForCommentは保存中の対象コメント一致を判定する", () => {
  const state: CommentOperationState = CommentOperationSavingState.create(
    "reopen",
    commentId("cmt_target"),
  );

  expect(
    CommentOperationSavingState.isForComment(state, commentId("cmt_target")),
  ).toBe(true);
  expect(
    CommentOperationSavingState.isForComment(state, commentId("cmt_other")),
  ).toBe(false);
});

test("CommentOperationFailedState.errorOfは失敗状態のエラーだけを取り出す", () => {
  const failedState: CommentOperationState = CommentOperationFailedState.create(
    "update",
    commentId("cmt_target"),
    featureError,
  );

  expect(CommentOperationFailedState.errorOf(failedState)).toBe(featureError);
  expect(
    CommentOperationFailedState.errorOf(CommentOperationIdleState.create()),
  ).toBeNull();
});

test("CommentOperationFailedState.errorForは失敗した操作種別に一致するエラーだけを取り出す", () => {
  const failedState: CommentOperationState = CommentOperationFailedState.create(
    "add",
    null,
    featureError,
  );

  expect(CommentOperationFailedState.errorFor(failedState, "add")).toBe(
    featureError,
  );
  expect(
    CommentOperationFailedState.errorFor(failedState, "update"),
  ).toBeNull();
});

test("CommentOperationStateはruntime companionとしてexportされない", () => {
  expect(commentOperationModule).not.toHaveProperty("CommentOperationState");
});
