import { expect, test, vi } from "vitest";
import type { Comment } from "@/features/comments/domain/comment";
import type { CommentAnchor } from "@/features/comments/domain/commentAnchor";
import type { CommentFeatureError } from "@/features/comments/domain/commentError";
import { CommentId } from "@/features/comments/domain/commentId";
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
import { AddCommentCommandError } from "@/lib/api/tauri/addComment";

const commentId = CommentId.fromString;

const anchor: CommentAnchor = {
  fileKey: "tasks",
  blockType: "paragraph",
  blockIndex: 0,
  textHash: "sha256:first",
  textSnippet: "Clarify this task",
  charRange: {
    start: 0,
    end: 18,
  },
};

const comment: Comment = {
  id: commentId("cmt_1"),
  anchor,
  body: "Clarify this task",
  status: "open",
  createdAt: "2026-05-05T10:00:00Z",
  updatedAt: "2026-05-05T10:00:00Z",
};

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

const readyListState: CommentListState = {
  status: "ready",
  comments: [comment],
  error: null,
};

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
  };
}

test("buildCommentsResultはlistStateとコメント操作結果からhook公開APIを組み立てる", () => {
  const reloadComments = vi.fn();
  const commentOperations = createCommentOperations();

  const result = buildCommentsResult({
    list: {
      listState: readyListState,
      reloadComments,
    },
    operations: commentOperations,
  });

  expect(result).toMatchObject<Partial<UseCommentsResult>>({
    listState: readyListState,
    operationState: commentOperations.operationState,
    comments: [comment],
    isLoading: false,
    isSaving: false,
    isEmpty: false,
    error: null,
    operationError: null,
    reloadComments,
    addComment: commentOperations.addComment,
    updateComment: commentOperations.updateComment,
    deleteComment: commentOperations.deleteComment,
    resolveComment: commentOperations.resolveComment,
    reopenComment: commentOperations.reopenComment,
  });
});

test.each([
  {
    label: "idle",
    operationState: CommentOperationIdleState.create(),
    expectedIsSaving: false,
    expectedOperationError: null,
  },
  {
    label: "saving",
    operationState: CommentOperationSavingState.create("add", null),
    expectedIsSaving: true,
    expectedOperationError: null,
  },
  {
    label: "error",
    operationState: CommentOperationFailedState.create(
      "update",
      comment.id,
      featureError,
    ),
    expectedIsSaving: false,
    expectedOperationError: featureError,
  },
] as const)("buildCommentsResultは$label状態から互換値を導出する", ({
  operationState,
  expectedIsSaving,
  expectedOperationError,
}) => {
  const result = buildCommentsResult({
    list: {
      listState: readyListState,
      reloadComments: vi.fn(),
    },
    operations: createCommentOperations(operationState),
  });

  expect(result.operationState).toBe(operationState);
  expect(result.isSaving).toBe(expectedIsSaving);
  expect(result.operationError).toBe(expectedOperationError);
});
