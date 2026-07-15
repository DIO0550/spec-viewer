import * as TestValues from "@/shared/testing/validatedValueObjects";
import { createCommentAnchorTestFixture } from "@/features/comments/testing/comment-anchor-test-fixture";
import { expect, test } from "vitest";

import { CommentListState } from "@/features/comments/domain/commentListState";
import type { Comment, CommentAnchor } from "@/features/comments/types/comment";

const commentId = TestValues.commentId;

const anchor: CommentAnchor = createCommentAnchorTestFixture({
  fileKey: "tasks",
  blockType: "paragraph",
  blockIndex: 0,
  textHash: "sha256:f1a57001",
  textSnippet: "Clarify this task",
  charRange: {
    start: 0,
    end: 18,
  },
});

const comment: Comment = {
  id: commentId("cmt_1"),
  anchor,
  body: "Clarify this task",
  status: "open",
  resolved: false,
  createdAt: TestValues.isoDateTime("2026-05-05T10:00:00Z"),
  updatedAt: TestValues.isoDateTime("2026-05-05T10:00:00Z"),
};

const updatedComment: Comment = {
  ...comment,
  body: "Updated body",
  updatedAt: TestValues.isoDateTime("2026-05-05T10:15:00Z"),
};

const featureError = { kind: "commentFailure" } as const;

test("CommentListState.idleはscope未選択の一覧状態を生成する", () => {
  expect(CommentListState.idle()).toEqual({
    status: "idle",
    comments: [],
    error: null,
  });
});

test("CommentListState.loadingは一覧読み込み中の状態を生成する", () => {
  expect(CommentListState.loading()).toEqual({
    status: "loading",
    comments: [],
    error: null,
  });
});

test("CommentListState.loadedはコメントが空ならempty状態を生成する", () => {
  expect(CommentListState.loaded([])).toEqual({
    status: "empty",
    comments: [],
    error: null,
  });
});

test("CommentListState.loadedはコメントがあればready状態を生成する", () => {
  expect(CommentListState.loaded([comment])).toEqual({
    status: "ready",
    comments: [comment],
    error: null,
  });
});

test("CommentListState.errorは正規化済みエラーを保持する", () => {
  expect(CommentListState.error(featureError)).toEqual({
    status: "error",
    comments: [],
    error: featureError,
  });
});

test.each([
  [CommentListState.idle(), true],
  [CommentListState.loading(), false],
  [CommentListState.loaded([comment]), false],
] as const)("CommentListState.isIdleはidle状態だけを判定する", (state, expected) => {
  expect(CommentListState.isIdle(state)).toBe(expected);
});

test.each([
  [CommentListState.loading(), true],
  [CommentListState.idle(), false],
  [CommentListState.loaded([comment]), false],
] as const)("CommentListState.isLoadingはloading状態だけを判定する", (state, expected) => {
  expect(CommentListState.isLoading(state)).toBe(expected);
});

test.each([
  [CommentListState.loaded([comment]), true],
  [CommentListState.loaded([]), true],
  [CommentListState.idle(), false],
  [CommentListState.loading(), false],
  [CommentListState.error(featureError), false],
] as const)("CommentListState.isLoadedはreadyとempty状態だけを判定する", (state, expected) => {
  expect(CommentListState.isLoaded(state)).toBe(expected);
});

test("CommentListState.applyTransformはidle状態ではtransformを適用しない", () => {
  const currentState = CommentListState.idle();
  const result = CommentListState.applyTransform(currentState, () => [
    updatedComment,
  ]);

  expect(result).toEqual({
    state: currentState,
    invalidatesRequest: false,
  });
});

test.each([
  [CommentListState.loaded([comment]), [updatedComment], "ready"],
  [CommentListState.loaded([comment]), [], "empty"],
  [CommentListState.loaded([]), [updatedComment], "ready"],
  [CommentListState.loading(), [updatedComment], "ready"],
  [CommentListState.error(featureError), [updatedComment], "ready"],
] as const)("CommentListState.applyTransformはidle以外の一覧を変換してloaded状態へ正規化する", (currentState, nextComments, expectedStatus) => {
  const result = CommentListState.applyTransform(
    currentState,
    () => nextComments,
  );

  expect(result.state.status).toBe(expectedStatus);
  expect(result.state.comments).toEqual(nextComments);
});

test("CommentListState.applyTransformはloading中にコメント参照が変わるとrequest無効化を返す", () => {
  const result = CommentListState.applyTransform(
    CommentListState.loading(),
    () => [updatedComment],
  );

  expect(result.invalidatesRequest).toBe(true);
});

test.each([
  [CommentListState.idle(), () => [updatedComment]],
  [CommentListState.loaded([comment]), () => [updatedComment]],
  [CommentListState.loaded([]), () => [updatedComment]],
  [CommentListState.error(featureError), () => [updatedComment]],
  [CommentListState.loading(), (comments: readonly Comment[]) => comments],
] as const)("CommentListState.applyTransformはloading中の参照変更以外でrequestを無効化しない", (currentState, transform) => {
  const result = CommentListState.applyTransform(currentState, transform);

  expect(result.invalidatesRequest).toBe(false);
});
