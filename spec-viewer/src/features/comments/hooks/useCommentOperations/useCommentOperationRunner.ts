import { useCallback, useEffect, useReducer, useRef } from "react";

import {
  CommentOperationEvent,
  CommentOperationIdleState,
  type CommentOperationKind,
  type CommentOperationState,
} from "@/features/comments/domain/commentOperation";
import { CommentOperationToken } from "@/features/comments/domain/commentOperationToken";
import type { CommentScope } from "@/features/comments/domain/commentScope";
import type {
  Comment,
  CommentId,
  DeleteCommentResponse,
} from "@/features/comments/types/comment";
import { normalizeCommandError } from "@/shared/api/tauri";

type CommentListTransform = (
  comments: readonly Comment[],
) => readonly Comment[];

type UseCommentOperationRunnerOptions = Readonly<{
  scope: CommentScope | null;
  scopeKey: string;
  /** @param transform - List transform applied to the active scope comments */
  updateCurrentScopeComments: (transform: CommentListTransform) => void;
  /** Reloads the active scope comments from the backend. */
  reloadComments: () => Promise<boolean>;
}>;

export type CommentMutationInput = Readonly<{
  operation: CommentOperationKind;
  commentId: CommentId | null;
  /** @param scope - Active comment scope captured when the mutation started */
  execute: (scope: CommentScope) => Promise<Comment>;
  /**
   * @param comments - Current scope comments
   * @param comment - Mutated comment returned by the backend
   */
  applyResult: (
    comments: readonly Comment[],
    comment: Comment,
  ) => readonly Comment[];
  /** Restores the optimistic list update after a failed mutation. */
  rollback?: () => void;
}>;

export type CommentDeletionInput = Readonly<{
  commentId: CommentId;
  /** @param scope - Active comment scope captured when the deletion started */
  execute: (scope: CommentScope) => Promise<DeleteCommentResponse>;
}>;

export type UseCommentOperationRunnerResult = Readonly<{
  operationState: CommentOperationState;
  /** @param input - Mutation kind, gateway call, and list reconciliation */
  runMutation: (input: CommentMutationInput) => Promise<Comment | null>;
  /** @param input - Target comment and the gateway deletion call */
  runDeletion: (input: CommentDeletionInput) => Promise<boolean>;
}>;

/**
 * @param options - Active scope identity and comment list callbacks.
 * @returns Operation state plus stale-safe mutation and deletion runners.
 */
export function useCommentOperationRunner({
  scope,
  scopeKey,
  updateCurrentScopeComments,
  reloadComments,
}: UseCommentOperationRunnerOptions): UseCommentOperationRunnerResult {
  const operationRequestIdRef = useRef(0);
  const activeOperationScopeKeyRef = useRef(scopeKey);
  const [operationState, dispatchOperation] = useReducer(
    CommentOperationEvent.reduce,
    undefined,
    CommentOperationIdleState.create,
  );

  activeOperationScopeKeyRef.current = scopeKey;

  const beginOperation = useCallback(
    (
      operation: CommentOperationKind,
      commentId: CommentId | null,
    ): CommentOperationToken | null => {
      if (scope === null) {
        return null;
      }

      const requestId = operationRequestIdRef.current + 1;
      operationRequestIdRef.current = requestId;
      dispatchOperation({
        type: "operationStarted",
        operation,
        commentId,
      });

      return CommentOperationToken.create(requestId, scopeKey);
    },
    [scope, scopeKey],
  );

  const canApplyOperationResult = useCallback(
    (token: CommentOperationToken): boolean =>
      CommentOperationToken.matches(token, {
        requestId: operationRequestIdRef.current,
        scopeKey: activeOperationScopeKeyRef.current,
      }),
    [],
  );

  useEffect(() => {
    operationRequestIdRef.current += 1;
    dispatchOperation({ type: "operationInvalidated" });
  }, [reloadComments, scopeKey]);

  const runMutation = useCallback(
    async ({
      operation,
      commentId,
      execute,
      applyResult,
      rollback,
    }: CommentMutationInput): Promise<Comment | null> => {
      const token = beginOperation(operation, commentId);
      if (token === null || scope === null) {
        return null;
      }

      try {
        const comment = await execute(scope);

        if (!canApplyOperationResult(token)) {
          return null;
        }

        updateCurrentScopeComments((comments) =>
          applyResult(comments, comment),
        );
        dispatchOperation({ type: "operationSucceeded" });
        return comment;
      } catch (error) {
        if (!canApplyOperationResult(token)) {
          return null;
        }

        rollback?.();
        dispatchOperation({
          type: "operationFailed",
          operation,
          commentId,
          error: normalizeCommandError(error),
        });
        return null;
      }
    },
    [
      beginOperation,
      canApplyOperationResult,
      scope,
      updateCurrentScopeComments,
    ],
  );

  const runDeletion = useCallback(
    async ({ commentId, execute }: CommentDeletionInput): Promise<boolean> => {
      const token = beginOperation("delete", commentId);
      if (token === null || scope === null) {
        return false;
      }

      try {
        const response = await execute(scope);

        if (!canApplyOperationResult(token)) {
          return false;
        }

        if (!response.deleted) {
          dispatchOperation({ type: "operationSucceeded" });
          return false;
        }

        updateCurrentScopeComments((comments) =>
          comments.filter((comment) => comment.id !== commentId),
        );
        dispatchOperation({ type: "operationSucceeded" });
        await reloadComments();
        return true;
      } catch (error) {
        if (!canApplyOperationResult(token)) {
          return false;
        }

        dispatchOperation({
          type: "operationFailed",
          operation: "delete",
          commentId,
          error: normalizeCommandError(error),
        });
        return false;
      }
    },
    [
      beginOperation,
      canApplyOperationResult,
      reloadComments,
      scope,
      updateCurrentScopeComments,
    ],
  );

  return { operationState, runMutation, runDeletion };
}
