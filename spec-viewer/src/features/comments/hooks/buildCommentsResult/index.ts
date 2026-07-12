import type { CommentListFeatureState } from "@/features/comments/application/commentError";
import {
  CommentOperationFailedState,
  CommentOperationSavingState,
} from "@/features/comments/domain/commentOperation";
import type { UseCommentOperationsResult } from "@/features/comments/hooks/useCommentOperations";
import type { UseCommentsResult } from "@/features/comments/hooks/useComments";

type CommentsListResultInput = Readonly<{
  listState: CommentListFeatureState;
  /** Reloads the comment list; resolves to true when the reload succeeds. */
  reloadComments: () => Promise<boolean>;
}>;

type CommentsOperationResultInput = UseCommentOperationsResult;

type CommentsResultInput = Readonly<{
  list: CommentsListResultInput;
  operations: CommentsOperationResultInput;
}>;

type CommentsResultBuilder = (input: CommentsResultInput) => UseCommentsResult;

/**
 * @param input - UI hook side list/reload input and operation input.
 * @returns Public result object exposed by useComments.
 */
export const buildCommentsResult: CommentsResultBuilder = (input) => {
  const { listState, reloadComments } = input.list;
  const commentOperations = input.operations;
  const { operationState } = commentOperations;

  return {
    listState,
    operationState,
    comments: listState.comments,
    isLoading: listState.status === "loading",
    isSaving: CommentOperationSavingState.is(operationState),
    isEmpty: listState.status === "empty",
    error: listState.error,
    operationError: CommentOperationFailedState.errorOf(operationState),
    reloadComments,
    addComment: commentOperations.addComment,
    updateComment: commentOperations.updateComment,
    deleteComment: commentOperations.deleteComment,
    resolveComment: commentOperations.resolveComment,
    reopenComment: commentOperations.reopenComment,
    toggleCommentResolved: commentOperations.toggleCommentResolved,
  };
};
