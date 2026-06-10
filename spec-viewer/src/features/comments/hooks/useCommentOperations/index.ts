import { useCallback, useEffect, useReducer, useRef } from "react";

import {
  CommentOperationFailedState,
  CommentOperationIdleState,
  type CommentOperationKind,
  CommentOperationSavingState,
  type CommentOperationState,
} from "@/features/comments/domain/commentOperation";
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
import {
  type CommentCommands,
  normalizeCommandError,
} from "@/shared/api/tauri";
import type { NormalizedCommandError } from "@/shared/types/ipc";

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
  updateCurrentScopeComments: (transform: CommentListTransform) => void;
  reloadComments: () => Promise<boolean>;
}>;

export type UseCommentOperationsResult = Readonly<{
  operationState: CommentOperationState;
  addComment: (input: AddCommentInput) => Promise<Comment | null>;
  updateComment: (input: UpdateCommentInput) => Promise<Comment | null>;
  deleteComment: (commentId: CommentId) => Promise<boolean>;
  resolveComment: (commentId: CommentId) => Promise<Comment | null>;
  reopenComment: (commentId: CommentId) => Promise<Comment | null>;
  toggleCommentResolved: (commentId: CommentId) => Promise<Comment | null>;
}>;

type CommentOperationEvent =
  | Readonly<{
      type: "operationStarted";
      operation: CommentOperationKind;
      commentId: CommentId | null;
    }>
  | Readonly<{ type: "operationSucceeded" }>
  | Readonly<{
      type: "operationFailed";
      operation: CommentOperationKind;
      commentId: CommentId | null;
      error: NormalizedCommandError;
    }>
  | Readonly<{ type: "operationInvalidated" }>;

type AsyncOperationToken = Readonly<{
  requestId: number;
  scopeKey: string;
}>;

const initialOperationState: CommentOperationState =
  CommentOperationIdleState.create();

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
  const operationRequestIdRef = useRef(0);
  const activeOperationScopeKeyRef = useRef(scopeKey);
  const [operationState, dispatchOperation] = useReducer(
    commentOperationReducer,
    initialOperationState,
  );

  activeOperationScopeKeyRef.current = scopeKey;

  const beginOperation = useCallback(
    (
      operation: CommentOperationKind,
      commentId: CommentId | null,
    ): AsyncOperationToken | null => {
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

      return createOperationToken(requestId, scopeKey);
    },
    [scope, scopeKey],
  );

  const canApplyOperationResult = useCallback(
    (token: AsyncOperationToken): boolean =>
      isMatchingOperationToken(
        token,
        operationRequestIdRef.current,
        activeOperationScopeKeyRef.current,
      ),
    [],
  );

  const markOperationSucceeded = useCallback((): void => {
    dispatchOperation({ type: "operationSucceeded" });
  }, []);

  const markOperationFailed = useCallback(
    (
      operation: CommentOperationKind,
      commentId: CommentId | null,
      error: unknown,
    ): void => {
      dispatchOperation({
        type: "operationFailed",
        operation,
        commentId,
        error: normalizeCommandError(error),
      });
    },
    [],
  );

  useEffect(() => {
    // Invalidate in-flight operations whenever the comment scope or its
    // reload entry point changes; the dependencies are intentional triggers.
    void [reloadComments, scopeKey];
    operationRequestIdRef.current += 1;
    dispatchOperation({ type: "operationInvalidated" });
  }, [reloadComments, scopeKey]);

  const addComment = useCallback(
    async (input: AddCommentInput): Promise<Comment | null> => {
      const token = beginOperation("add", null);
      if (token === null || scope === null) {
        return null;
      }

      try {
        const comment = await addCommentViaGateway(commands, scope, {
          anchor: input.anchor,
          body: input.body,
        });

        if (!canApplyOperationResult(token)) {
          return null;
        }

        updateCurrentScopeComments((comments) =>
          Comments.appendDisplayable(comments, comment, statusFilter),
        );
        markOperationSucceeded();
        return comment;
      } catch (error) {
        if (!canApplyOperationResult(token)) {
          return null;
        }

        markOperationFailed("add", null, error);
        return null;
      }
    },
    [
      beginOperation,
      canApplyOperationResult,
      commands,
      markOperationFailed,
      markOperationSucceeded,
      scope,
      statusFilter,
      updateCurrentScopeComments,
    ],
  );

  const updateComment = useCallback(
    async (input: UpdateCommentInput): Promise<Comment | null> => {
      const token = beginOperation("update", input.commentId);
      if (token === null || scope === null) {
        return null;
      }

      try {
        const comment = await updateCommentViaGateway(commands, scope, {
          commentId: input.commentId,
          body: input.body,
        });

        if (!canApplyOperationResult(token)) {
          return null;
        }

        updateCurrentScopeComments((comments) =>
          Comments.upsertDisplayable(comments, comment, statusFilter),
        );
        markOperationSucceeded();
        return comment;
      } catch (error) {
        if (!canApplyOperationResult(token)) {
          return null;
        }

        markOperationFailed("update", input.commentId, error);
        return null;
      }
    },
    [
      beginOperation,
      canApplyOperationResult,
      commands,
      markOperationFailed,
      markOperationSucceeded,
      scope,
      statusFilter,
      updateCurrentScopeComments,
    ],
  );

  const deleteComment = useCallback(
    async (commentId: CommentId): Promise<boolean> => {
      const token = beginOperation("delete", commentId);
      if (token === null || scope === null) {
        return false;
      }

      try {
        const response = await deleteCommentViaGateway(
          commands,
          scope,
          commentId,
        );

        if (!canApplyOperationResult(token)) {
          return false;
        }

        if (!response.deleted) {
          markOperationSucceeded();
          return false;
        }

        updateCurrentScopeComments((comments) =>
          comments.filter((comment) => comment.id !== commentId),
        );
        markOperationSucceeded();
        await reloadComments();
        return true;
      } catch (error) {
        if (!canApplyOperationResult(token)) {
          return false;
        }

        markOperationFailed("delete", commentId, error);
        return false;
      }
    },
    [
      beginOperation,
      canApplyOperationResult,
      commands,
      markOperationFailed,
      markOperationSucceeded,
      reloadComments,
      scope,
      updateCurrentScopeComments,
    ],
  );

  const resolveComment = useCallback(
    async (commentId: CommentId): Promise<Comment | null> => {
      const token = beginOperation("resolve", commentId);
      if (token === null || scope === null) {
        return null;
      }

      try {
        const comment = await resolveCommentViaGateway(
          commands,
          scope,
          commentId,
        );

        if (!canApplyOperationResult(token)) {
          return null;
        }

        updateCurrentScopeComments((comments) =>
          Comments.upsertDisplayable(comments, comment, statusFilter),
        );
        markOperationSucceeded();
        return comment;
      } catch (error) {
        if (!canApplyOperationResult(token)) {
          return null;
        }

        markOperationFailed("resolve", commentId, error);
        return null;
      }
    },
    [
      beginOperation,
      canApplyOperationResult,
      commands,
      markOperationFailed,
      markOperationSucceeded,
      scope,
      statusFilter,
      updateCurrentScopeComments,
    ],
  );

  const reopenComment = useCallback(
    async (commentId: CommentId): Promise<Comment | null> => {
      const token = beginOperation("reopen", commentId);
      if (token === null || scope === null) {
        return null;
      }

      try {
        const comment = await reopenCommentViaGateway(
          commands,
          scope,
          commentId,
        );

        if (!canApplyOperationResult(token)) {
          return null;
        }

        updateCurrentScopeComments((comments) =>
          Comments.upsertDisplayable(comments, comment, statusFilter),
        );
        markOperationSucceeded();
        return comment;
      } catch (error) {
        if (!canApplyOperationResult(token)) {
          return null;
        }

        markOperationFailed("reopen", commentId, error);
        return null;
      }
    },
    [
      beginOperation,
      canApplyOperationResult,
      commands,
      markOperationFailed,
      markOperationSucceeded,
      scope,
      statusFilter,
      updateCurrentScopeComments,
    ],
  );

  const toggleCommentResolved = useCallback(
    async (commentId: CommentId): Promise<Comment | null> => {
      const token = beginOperation("toggle", commentId);
      if (token === null || scope === null) {
        return null;
      }

      const previousComments = currentComments;
      updateCurrentScopeComments((comments) =>
        Comments.upsertOptimisticToggle(comments, commentId, statusFilter),
      );

      try {
        const comment = await toggleCommentResolvedViaGateway(
          commands,
          scope,
          commentId,
        );

        if (!canApplyOperationResult(token)) {
          return null;
        }

        updateCurrentScopeComments((comments) =>
          Comments.upsertDisplayable(comments, comment, statusFilter),
        );
        markOperationSucceeded();
        return comment;
      } catch (error) {
        if (!canApplyOperationResult(token)) {
          return null;
        }

        updateCurrentScopeComments(() => previousComments);
        markOperationFailed("toggle", commentId, error);
        return null;
      }
    },
    [
      beginOperation,
      canApplyOperationResult,
      commands,
      currentComments,
      markOperationFailed,
      markOperationSucceeded,
      scope,
      statusFilter,
      updateCurrentScopeComments,
    ],
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

/**
 * @param _state - Current operation state.
 * @param event - Operation lifecycle event.
 * @returns Next operation state.
 */
function commentOperationReducer(
  _state: CommentOperationState,
  event: CommentOperationEvent,
): CommentOperationState {
  switch (event.type) {
    case "operationStarted":
      return CommentOperationSavingState.create(
        event.operation,
        event.commentId,
      );
    case "operationSucceeded":
    case "operationInvalidated":
      return initialOperationState;
    case "operationFailed":
      return CommentOperationFailedState.create(
        event.operation,
        event.commentId,
        event.error,
      );
    default:
      return assertNever(event);
  }
}

/**
 * @param value - Value that should have been narrowed to never.
 * @returns Never returns because exhaustive handling failed.
 * @throws Error when an unhandled union member reaches runtime.
 */
function assertNever(value: never): never {
  throw new Error(
    `Unhandled comment operation event: ${JSON.stringify(value)}`,
  );
}

/**
 * @param requestId - Operation request id.
 * @param scopeKey - Scope key captured when the request started.
 * @returns Token used to reject stale operation results.
 */
function createOperationToken(
  requestId: number,
  scopeKey: string,
): AsyncOperationToken {
  return { requestId, scopeKey };
}

/**
 * @param token - Captured operation token.
 * @param latestRequestId - Most recent operation request id.
 * @param currentScopeKey - Current active scope key.
 * @returns True when the async operation still belongs to the current scope.
 */
function isMatchingOperationToken(
  token: AsyncOperationToken,
  latestRequestId: number,
  currentScopeKey: string,
): boolean {
  return (
    token.requestId === latestRequestId && token.scopeKey === currentScopeKey
  );
}
