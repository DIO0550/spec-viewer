import { expect, test, vi } from "vitest";

import {
  CommentOperationFailedState,
  CommentOperationIdleState,
  CommentOperationSavingState,
} from "@/features/comments/domain/commentOperation";
import { buildCommentsResult } from "@/features/comments/hooks/buildCommentsResult";
import type { UseCommentOperationsResult } from "@/features/comments/hooks/useCommentOperations";
import type {
  CommentListState,
  UseCommentsResult,
} from "@/features/comments/hooks/useComments";
import type { CommentFeatureError } from "@/features/comments/application/commentError";
import { toCommentFeatureError } from "@/features/comments/infra/tauri/commentErrorMapper";
import { createCommentTestFixture } from "@/features/comments/testing/comment-test-fixture";

const comment = createCommentTestFixture();

const featureError: CommentFeatureError = toCommentFeatureError("add", {
  code: "commentRepository",
  message: "Comment operation failed.",
});

function createCommentOperations(
  operationState: UseCommentOperationsResult["operationState"] = CommentOperationIdleState.create(),
): UseCommentOperationsResult {
  return {
    operationState,
    addComment: vi.fn(),
    updateComment: vi.fn(),
    deleteComment: vi.fn(),
    resolveComment: vi.fn(),
    reopenComment: vi.fn(),
    toggleCommentResolved: vi.fn(),
  };
}

test("buildCommentsResultはlistStateとコメント操作結果からhook公開APIを組み立てる", () => {
  const reloadComments = vi.fn();
  const listState: CommentListState = {
    status: "ready",
    comments: [comment],
    error: null,
  };
  const commentOperations = createCommentOperations(
    CommentOperationSavingState.create("add", null),
  );

  const result = buildCommentsResult({
    list: {
      listState,
      reloadComments,
    },
    operations: commentOperations,
  });

  expect(result).toMatchObject<Partial<UseCommentsResult>>({
    listState,
    operationState: commentOperations.operationState,
    comments: [comment],
    isLoading: false,
    isSaving: true,
    isEmpty: false,
    error: null,
    operationError: null,
    reloadComments,
    addComment: commentOperations.addComment,
    updateComment: commentOperations.updateComment,
    deleteComment: commentOperations.deleteComment,
    resolveComment: commentOperations.resolveComment,
    reopenComment: commentOperations.reopenComment,
    toggleCommentResolved: commentOperations.toggleCommentResolved,
  });
});

test("buildCommentsResultはoperation失敗時のエラーをoperationErrorとして公開する", () => {
  const listState: CommentListState = {
    status: "ready",
    comments: [comment],
    error: null,
  };
  const commentOperations = createCommentOperations(
    CommentOperationFailedState.create("update", comment.id, featureError),
  );

  const result = buildCommentsResult({
    list: {
      listState,
      reloadComments: vi.fn(),
    },
    operations: commentOperations,
  });

  expect(result.operationError).toBe(featureError);
});
