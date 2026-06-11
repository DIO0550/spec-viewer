import { useCallback } from "react";

import type { CommentOperationState } from "@/features/comments/domain/commentOperation";
import type { CommentScope } from "@/features/comments/domain/commentScope";
import type { CommentStatusFilter } from "@/features/comments/domain/commentStatusFilter";
import { Comments } from "@/features/comments/domain/comments";
import {
  addComment as addCommentViaGateway,
  deleteComment as deleteCommentViaGateway,
  reopenComment as reopenCommentViaGateway,
  resolveComment as resolveCommentViaGateway,
  toggleCommentResolved as toggleCommentResolvedViaGateway,
  updateComment as updateCommentViaGateway,
} from "@/features/comments/infra/commentGateway";
import type {
  Comment,
  CommentAnchor,
  CommentId,
} from "@/features/comments/types/comment";
import type { CommentCommands } from "@/shared/api/tauri";

import { useCommentOperationRunner } from "./useCommentOperationRunner";

export type AddCommentInput = Readonly<{
  anchor: CommentAnchor;
  body: string;
}>;

export type UpdateCommentInput = Readonly<{
  commentId: CommentId;
  body: string;
}>;

export type CommentListTransform = (
  comments: readonly Comment[],
) => readonly Comment[];

export type UseCommentOperationsOptions = Readonly<{
  scope: CommentScope | null;
  scopeKey: string;
  statusFilter: CommentStatusFilter;
  commands: CommentCommands;
  currentComments: readonly Comment[];
  /** @param transform - List transform applied to the active scope comments */
  updateCurrentScopeComments: (transform: CommentListTransform) => void;
  /** Reloads the active scope comments from the backend. */
  reloadComments: () => Promise<boolean>;
}>;

export type UseCommentOperationsResult = Readonly<{
  operationState: CommentOperationState;
  /** @param input - Anchor and body for the new comment */
  addComment: (input: AddCommentInput) => Promise<Comment | null>;
  /** @param input - Comment id and replacement body */
  updateComment: (input: UpdateCommentInput) => Promise<Comment | null>;
  /** @param commentId - Comment to delete */
  deleteComment: (commentId: CommentId) => Promise<boolean>;
  /** @param commentId - Comment to resolve */
  resolveComment: (commentId: CommentId) => Promise<Comment | null>;
  /** @param commentId - Comment to reopen */
  reopenComment: (commentId: CommentId) => Promise<Comment | null>;
  /** @param commentId - Comment whose resolved status should toggle */
  toggleCommentResolved: (commentId: CommentId) => Promise<Comment | null>;
}>;

/**
 * @param options - Active comment scope, command boundary, and list callbacks.
 * @returns Comment operation state and operation callbacks for the active scope.
 */
export function useCommentOperations(
  options: UseCommentOperationsOptions,
): UseCommentOperationsResult {
  const {
    commands,
    currentComments,
    reloadComments,
    scope,
    scopeKey,
    statusFilter,
    updateCurrentScopeComments,
  } = options;
  const { operationState, runMutation, runDeletion } =
    useCommentOperationRunner({
      scope,
      scopeKey,
      updateCurrentScopeComments,
      reloadComments,
    });

  const upsertDisplayable = useCallback(
    (comments: readonly Comment[], comment: Comment): readonly Comment[] =>
      Comments.upsertDisplayable(comments, comment, statusFilter),
    [statusFilter],
  );

  const addComment = useCallback(
    async (input: AddCommentInput): Promise<Comment | null> =>
      runMutation({
        operation: "add",
        commentId: null,
        /**
         * Adds the comment through the gateway.
         * @param activeScope - Scope to add the comment in.
         */
        execute: (activeScope) =>
          addCommentViaGateway(commands, activeScope, {
            anchor: input.anchor,
            body: input.body,
          }),
        /**
         * Appends the added comment when the status filter displays it.
         * @param comments - Current comment list.
         * @param comment - Added comment to append.
         */
        applyResult: (comments, comment) =>
          Comments.appendDisplayable(comments, comment, statusFilter),
      }),
    [commands, runMutation, statusFilter],
  );

  const updateComment = useCallback(
    async (input: UpdateCommentInput): Promise<Comment | null> =>
      runMutation({
        operation: "update",
        commentId: input.commentId,
        /**
         * Updates the comment body through the gateway.
         * @param activeScope - Scope the comment belongs to.
         */
        execute: (activeScope) =>
          updateCommentViaGateway(commands, activeScope, {
            commentId: input.commentId,
            body: input.body,
          }),
        applyResult: upsertDisplayable,
      }),
    [commands, runMutation, upsertDisplayable],
  );

  const resolveComment = useCallback(
    async (commentId: CommentId): Promise<Comment | null> =>
      runMutation({
        operation: "resolve",
        commentId,
        /**
         * Resolves the comment through the gateway.
         * @param activeScope - Scope the comment belongs to.
         */
        execute: (activeScope) =>
          resolveCommentViaGateway(commands, activeScope, commentId),
        applyResult: upsertDisplayable,
      }),
    [commands, runMutation, upsertDisplayable],
  );

  const reopenComment = useCallback(
    async (commentId: CommentId): Promise<Comment | null> =>
      runMutation({
        operation: "reopen",
        commentId,
        /**
         * Reopens the comment through the gateway.
         * @param activeScope - Scope the comment belongs to.
         */
        execute: (activeScope) =>
          reopenCommentViaGateway(commands, activeScope, commentId),
        applyResult: upsertDisplayable,
      }),
    [commands, runMutation, upsertDisplayable],
  );

  const toggleCommentResolved = useCallback(
    async (commentId: CommentId): Promise<Comment | null> => {
      if (scope === null) {
        return null;
      }

      const previousComments = currentComments;
      updateCurrentScopeComments((comments) =>
        Comments.upsertOptimisticToggle(comments, commentId, statusFilter),
      );

      return runMutation({
        operation: "toggle",
        commentId,
        /**
         * Toggles the comment resolved status through the gateway.
         * @param activeScope - Scope the comment belongs to.
         */
        execute: (activeScope) =>
          toggleCommentResolvedViaGateway(commands, activeScope, commentId),
        applyResult: upsertDisplayable,
        /** Restores the comment list captured before the optimistic toggle. */
        rollback: () => {
          updateCurrentScopeComments(() => previousComments);
        },
      });
    },
    [
      commands,
      currentComments,
      runMutation,
      scope,
      statusFilter,
      updateCurrentScopeComments,
      upsertDisplayable,
    ],
  );

  const deleteComment = useCallback(
    async (commentId: CommentId): Promise<boolean> =>
      runDeletion({
        commentId,
        /**
         * Deletes the comment through the gateway.
         * @param activeScope - Scope the comment belongs to.
         */
        execute: (activeScope) =>
          deleteCommentViaGateway(commands, activeScope, commentId),
      }),
    [commands, runDeletion],
  );

  return {
    operationState,
    addComment,
    updateComment,
    deleteComment,
    resolveComment,
    reopenComment,
    toggleCommentResolved,
  };
}
