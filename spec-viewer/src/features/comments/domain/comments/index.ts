import {
  Comment,
  type CommentReconciliationError,
  type CommentRevisionExpectation,
  type Comment as CommentType,
  type ReconcileCommentCreationInput,
} from "@/features/comments/domain/comment";
import type {
  CommentStatus,
  CommentStatusFilter,
} from "@/features/comments/domain/commentStatusFilter";
import type { CommentId } from "@/shared/domain/commentId";

export type ReconcileCommentRevisionInput = Readonly<{
  commentId: CommentId;
  revision: CommentRevisionExpectation;
}>;

export type ApplyValidatedRevisionInput = Readonly<{
  response: CommentType;
  revision: ReconcileCommentRevisionInput;
  previousComments: readonly CommentType[];
  statusFilter: CommentStatusFilter;
}>;

export type RollbackOptimisticToggleInput = Readonly<{
  commentId: CommentId;
  previousComments: readonly CommentType[];
  optimisticComments: readonly CommentType[];
  statusFilter: CommentStatusFilter;
}>;

export type CommentListRestorationError =
  | Readonly<{
      reason: "duplicateCommentId";
      commentId: CommentId;
      firstIndex: number;
      duplicateIndex: number;
    }>
  | Readonly<{
      reason: "statusFilterMismatch";
      commentId: CommentId;
      index: number;
      expectedStatusFilter: CommentStatusFilter;
      actualStatus: CommentStatus;
    }>;

export type CommentListRestorationResult =
  | Readonly<{ ok: true; value: readonly CommentType[] }>
  | Readonly<{ ok: false; error: CommentListRestorationError }>;

export type CommentsReconciliationError =
  | CommentReconciliationError
  | Readonly<{ reason: "commentNotFound"; commentId: CommentId }>
  | Readonly<{ reason: "duplicateCommentId"; commentId: CommentId }>;

export type CommentsReconciliationResult =
  | Readonly<{
      ok: true;
      value: Readonly<{
        comments: readonly CommentType[];
        comment: CommentType;
      }>;
    }>
  | Readonly<{ ok: false; error: CommentsReconciliationError }>;

export const Comments = {
  /**
   * @param comments - Decoded comments returned by the list boundary.
   * @param statusFilter - Status filter used for the list request.
   * @returns A fresh validated collection, or the first collection invariant violation.
   */
  restoreList(
    comments: readonly CommentType[],
    statusFilter: CommentStatusFilter,
  ): CommentListRestorationResult {
    const firstIndexByCommentId = new Map<CommentId, number>();
    const restoredComments: CommentType[] = [];

    for (const [index, comment] of comments.entries()) {
      const firstIndex = firstIndexByCommentId.get(comment.id);
      if (firstIndex !== undefined) {
        return {
          ok: false,
          error: {
            reason: "duplicateCommentId",
            commentId: comment.id,
            firstIndex,
            duplicateIndex: index,
          },
        };
      }

      if (!Comment.matchesStatusFilter(comment, statusFilter)) {
        return {
          ok: false,
          error: {
            reason: "statusFilterMismatch",
            commentId: comment.id,
            index,
            expectedStatusFilter: statusFilter,
            actualStatus: comment.status,
          },
        };
      }

      firstIndexByCommentId.set(comment.id, index);
      restoredComments.push(comment);
    }

    return { ok: true, value: restoredComments };
  },

  /**
   * @param comments - Current visible comments.
   * @param commentId - Comment identity to find.
   * @returns The matching aggregate, or undefined.
   */
  findById(
    comments: readonly CommentType[],
    commentId: CommentId,
  ): CommentType | undefined {
    return comments.find((comment) => comment.id === commentId);
  },

  /**
   * @param comments - Current visible comments.
   * @param response - Decoded add response.
   * @param expectation - Submitted anchor and body.
   * @param statusFilter - Active status filter.
   * @returns Reconciled creation and next visible collection.
   */
  appendDisplayable(
    comments: readonly CommentType[],
    response: CommentType,
    expectation: ReconcileCommentCreationInput,
    statusFilter: CommentStatusFilter,
  ): CommentsReconciliationResult {
    const reconciled = Comment.reconcileCreation(response, expectation);
    if (!reconciled.ok) {
      return reconciled;
    }

    const existingComment = Comments.findById(comments, reconciled.value.id);
    if (existingComment !== undefined) {
      if (Comment.hasSamePersistedState(existingComment, reconciled.value)) {
        return reconciliationSuccess(comments, existingComment);
      }

      return {
        ok: false,
        error: {
          reason: "duplicateCommentId",
          commentId: reconciled.value.id,
        },
      };
    }

    const nextComments = Comment.matchesStatusFilter(
      reconciled.value,
      statusFilter,
    )
      ? [...comments, reconciled.value]
      : comments;

    return reconciliationSuccess(nextComments, reconciled.value);
  },

  /**
   * @param comments - Latest visible comments.
   * @param response - Decoded revision response.
   * @param input - Expected identity and operation-specific revision.
   * @param statusFilter - Active status filter.
   * @returns Reconciled revision and next visible collection.
   */
  replaceExistingDisplayable(
    comments: readonly CommentType[],
    response: CommentType,
    input: ReconcileCommentRevisionInput,
    statusFilter: CommentStatusFilter,
  ): CommentsReconciliationResult {
    const currentComment = Comments.findById(comments, input.commentId);
    if (currentComment === undefined) {
      return {
        ok: false,
        error: {
          reason: "commentNotFound",
          commentId: input.commentId,
        },
      };
    }

    const reconciled = Comment.reconcileRevision(
      currentComment,
      response,
      input.revision,
    );
    if (!reconciled.ok) {
      return reconciled;
    }

    return reconciliationSuccess(
      replaceDisplayable(comments, reconciled.value, statusFilter),
      reconciled.value,
    );
  },

  /**
   * @param comments - Latest visible comments.
   * @param input - Validated response, original collection, and revision contract.
   * @returns Response reapplied after validating it against the latest target revision.
   */
  applyValidatedRevision(
    comments: readonly CommentType[],
    input: ApplyValidatedRevisionInput,
  ): CommentsReconciliationResult {
    const currentComment = Comments.findById(
      comments,
      input.revision.commentId,
    );
    if (currentComment !== undefined) {
      const reconciled = Comment.reconcileRevision(
        currentComment,
        input.response,
        input.revision.revision,
      );
      if (!reconciled.ok) {
        return reconciled;
      }

      return reconciliationSuccess(
        replaceDisplayable(comments, reconciled.value, input.statusFilter),
        reconciled.value,
      );
    }

    if (!Comment.matchesStatusFilter(input.response, input.statusFilter)) {
      return reconciliationSuccess(comments, input.response);
    }

    const previousIndex = input.previousComments.findIndex(
      (comment) => comment.id === input.revision.commentId,
    );
    if (previousIndex < 0) {
      return {
        ok: false,
        error: {
          reason: "commentNotFound",
          commentId: input.revision.commentId,
        },
      };
    }

    return reconciliationSuccess(
      insertAtCommentIndex(comments, input.response, previousIndex),
      input.response,
    );
  },

  /**
   * @param comments - Current visible comments.
   * @param commentId - Comment id to toggle locally.
   * @param statusFilter - Active status filter.
   * @returns Comments after an optimistic status toggle with unchanged timestamp.
   */
  upsertOptimisticToggle(
    comments: readonly CommentType[],
    commentId: CommentId,
    statusFilter: CommentStatusFilter,
  ): readonly CommentType[] {
    const currentComment = Comments.findById(comments, commentId);

    if (currentComment === undefined) {
      return comments;
    }

    const statusChange = Comment.isResolved(currentComment)
      ? Comment.reopen(currentComment, { updatedAt: currentComment.updatedAt })
      : Comment.resolve(currentComment, {
          updatedAt: currentComment.updatedAt,
        });

    if (!statusChange.ok) {
      return comments;
    }

    return replaceDisplayable(comments, statusChange.value, statusFilter);
  },

  /**
   * @param comments - Latest visible comments.
   * @param input - Before-image and optimistic collection captured by the toggle.
   * @returns Collection with only the still-owned optimistic target restored.
   */
  rollbackOptimisticToggle(
    comments: readonly CommentType[],
    input: RollbackOptimisticToggleInput,
  ): readonly CommentType[] {
    const previousComment = Comments.findById(
      input.previousComments,
      input.commentId,
    );
    if (
      previousComment === undefined ||
      !Comment.matchesStatusFilter(previousComment, input.statusFilter)
    ) {
      return comments;
    }

    const currentComment = Comments.findById(comments, input.commentId);
    const optimisticComment = Comments.findById(
      input.optimisticComments,
      input.commentId,
    );
    if (optimisticComment === undefined) {
      if (currentComment !== undefined) {
        return comments;
      }

      const previousIndex = input.previousComments.findIndex(
        (comment) => comment.id === input.commentId,
      );
      return insertAtCommentIndex(comments, previousComment, previousIndex);
    }

    if (currentComment !== optimisticComment) {
      return comments;
    }

    return comments.map((comment) =>
      comment.id === input.commentId ? previousComment : comment,
    );
  },

  /**
   * @param comments - Current visible comments.
   * @param commentId - Comment identity to remove.
   * @returns A collection without the comment, preserving the original reference when absent.
   */
  remove(
    comments: readonly CommentType[],
    commentId: CommentId,
  ): readonly CommentType[] {
    if (Comments.findById(comments, commentId) === undefined) {
      return comments;
    }

    return comments.filter((comment) => comment.id !== commentId);
  },
} as const;

/**
 * @param comments - Current visible collection.
 * @param comment - Reconciled aggregate.
 * @param statusFilter - Active status filter.
 * @returns Collection with the reconciled aggregate replaced or hidden.
 */
function replaceDisplayable(
  comments: readonly CommentType[],
  comment: CommentType,
  statusFilter: CommentStatusFilter,
): readonly CommentType[] {
  if (!Comment.matchesStatusFilter(comment, statusFilter)) {
    return comments.filter((candidate) => candidate.id !== comment.id);
  }

  return comments.map((candidate) =>
    candidate.id === comment.id ? comment : candidate,
  );
}

/**
 * @param comments - Current visible collection.
 * @param comment - Comment to insert.
 * @param requestedIndex - Preferred index from the operation start snapshot.
 * @returns Collection with the comment inserted at a bounded index.
 */
function insertAtCommentIndex(
  comments: readonly CommentType[],
  comment: CommentType,
  requestedIndex: number,
): readonly CommentType[] {
  const index = Math.min(Math.max(requestedIndex, 0), comments.length);

  return [...comments.slice(0, index), comment, ...comments.slice(index)];
}

/**
 * @param comments - Reconciled visible collection.
 * @param comment - Reconciled aggregate returned to the caller.
 * @returns Successful collection reconciliation result.
 */
function reconciliationSuccess(
  comments: readonly CommentType[],
  comment: CommentType,
): CommentsReconciliationResult {
  return { ok: true, value: { comments, comment } };
}
