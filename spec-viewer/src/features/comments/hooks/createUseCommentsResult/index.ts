import {
  CommentOperationFailedState,
  CommentOperationSavingState,
} from "@/features/comments/domain/commentOperation";
import type { CommentListState } from "@/features/comments/domain/commentListState";
import type { UseCommentOperationsResult } from "@/features/comments/hooks/useCommentOperations";
import type { UseCommentsResult } from "@/features/comments/hooks/useComments";

export type CreateUseCommentsResultInput = Readonly<{
  listState: CommentListState;
  commentOperations: UseCommentOperationsResult;
  reloadComments: () => Promise<boolean>;
}>;

/**
 * @param input - Current list state, comment operation callbacks, and reload function.
 * @returns Public result object exposed by useComments.
 */
export function createUseCommentsResult({
  listState,
  commentOperations,
  reloadComments,
}: CreateUseCommentsResultInput): UseCommentsResult {
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
}
