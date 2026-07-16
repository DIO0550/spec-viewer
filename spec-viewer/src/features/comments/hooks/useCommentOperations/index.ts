import { useCallback, useLayoutEffect, useReducer, useRef } from "react";
import type {
  CommentFeatureError as CommentFeatureErrorType,
  CommentOperationFeatureState,
} from "@/features/comments/application/commentError";
import type { CommentCommands } from "@/features/comments/application/ports/commentCommands";
import {
  Comment as CommentAggregate,
  type ReconcileCommentCreationInput,
} from "@/features/comments/domain/comment";
import type { CommentBody } from "@/features/comments/domain/commentBody";
import {
  CommentOperationFailedState,
  CommentOperationIdleState,
  type CommentOperationKind,
  CommentOperationSavingState,
} from "@/features/comments/domain/commentOperation";
import type { CommentScope } from "@/features/comments/domain/commentScope";
import type { CommentStatusFilter } from "@/features/comments/domain/commentStatusFilter";
import {
  Comments,
  type CommentsReconciliationResult,
  type ReconcileCommentRevisionInput,
} from "@/features/comments/domain/comments";
import {
  addComment as addCommentViaGateway,
  deleteComment as deleteCommentViaGateway,
  reopenComment as reopenCommentViaGateway,
  resolveComment as resolveCommentViaGateway,
  toggleCommentResolved as toggleCommentResolvedViaGateway,
  updateComment as updateCommentViaGateway,
} from "@/features/comments/infra/commentGateway";
import { toCommentFeatureError } from "@/features/comments/infra/tauri/commentErrorMapper";
import type {
  Comment,
  CommentAnchor,
  CommentId,
} from "@/features/comments/types/comment";
import {
  SelectionIdentity,
  type SelectionIdentity as SelectionIdentityType,
} from "@/shared/domain/specViewSelection";

export type AddCommentInput = Readonly<{
  anchor: CommentAnchor;
  body: CommentBody;
}>;

export type UpdateCommentInput = Readonly<{
  commentId: CommentId;
  body: CommentBody;
}>;

export type CommentListTransform = (
  comments: readonly Comment[],
) => readonly Comment[];

export type CommentCollectionSnapshot = Readonly<{
  comments: readonly Comment[];
  revision: number;
  isLoading: boolean;
  selectionIdentity: SelectionIdentityType | null;
  statusFilter: CommentStatusFilter;
}>;

export type UseCommentOperationsOptions = Readonly<{
  scope: CommentScope | null;
  selectionIdentity: SelectionIdentityType | null;
  statusFilter: CommentStatusFilter;
  commands: CommentCommands;
  currentComments: readonly Comment[];
  isListLoading?: boolean;
  listCollectionRevision?: number;
  getCurrentScopeSnapshot?: () => CommentCollectionSnapshot;
  /** @param transform - Transform applied to the active scope comment list. */
  updateCurrentScopeComments: (transform: CommentListTransform) => void;
  /** Reloads comments for the active scope. */
  reloadComments: () => Promise<boolean>;
}>;

export type UseCommentOperationsResult = Readonly<{
  operationState: CommentOperationFeatureState;
  /** @param input - Anchor and body for the new comment. */
  addComment: (input: AddCommentInput) => Promise<Comment | null>;
  /** @param input - Comment id and new body for the update. */
  updateComment: (input: UpdateCommentInput) => Promise<Comment | null>;
  /** @param commentId - Id of the comment to delete. */
  deleteComment: (commentId: CommentId) => Promise<boolean>;
  /** @param commentId - Id of the comment to resolve. */
  resolveComment: (commentId: CommentId) => Promise<Comment | null>;
  /** @param commentId - Id of the comment to reopen. */
  reopenComment: (commentId: CommentId) => Promise<Comment | null>;
  /** @param commentId - Id of the comment to toggle. */
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
      error: CommentFeatureErrorType;
    }>
  | Readonly<{ type: "operationInvalidated" }>;

type AsyncOperationToken = Readonly<{
  requestId: number;
  dataContextVersion: number;
  listCollectionRevision: number;
  commentId: CommentId | null;
  selectionIdentity: SelectionIdentityType;
  statusFilter: CommentStatusFilter;
  statusFilterGeneration: number;
}>;
type OperationContext = Readonly<{
  reloadComments: () => Promise<boolean>;
  selectionIdentity: SelectionIdentityType | null;
  statusFilter: CommentStatusFilter;
}>;
type OperationContextChanges = Readonly<{
  reloadCommentsChanged: boolean;
  selectionChanged: boolean;
  statusFilterChanged: boolean;
}>;
type DataOperationOwnershipContext = Readonly<{
  dataContextVersion: number;
  latestDataRequestByComment: ReadonlyMap<CommentId, number>;
  selectionIdentity: SelectionIdentityType | null;
}>;
type CommentRevisionOperationKind = Extract<
  CommentOperationKind,
  "update" | "resolve" | "reopen" | "toggle"
>;

const initialOperationState: CommentOperationFeatureState =
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
    getCurrentScopeSnapshot,
    isListLoading = false,
    listCollectionRevision = 0,
    reloadComments,
    scope,
    selectionIdentity,
    statusFilter,
    updateCurrentScopeComments,
  } = options;
  const operationRequestIdRef = useRef(0);
  const dataContextVersionRef = useRef(0);
  const latestDataRequestByCommentRef = useRef(new Map<CommentId, number>());
  const activeSelectionIdentityRef = useRef(selectionIdentity);
  const activeCommentsRef = useRef(currentComments);
  const activeListCollectionRevisionRef = useRef(listCollectionRevision);
  const activeReloadCommentsRef = useRef(reloadComments);
  const activeStatusFilterRef = useRef(statusFilter);
  const activeStatusFilterGenerationRef = useRef(0);
  const committedOperationContextRef = useRef<OperationContext>({
    reloadComments,
    selectionIdentity,
    statusFilter,
  });
  const [operationState, dispatchOperation] = useReducer(
    commentOperationReducer,
    initialOperationState,
  );

  const readCurrentScopeSnapshot = useCallback(
    (): CommentCollectionSnapshot =>
      getCurrentScopeSnapshot?.() ?? {
        comments: activeCommentsRef.current,
        revision: activeListCollectionRevisionRef.current,
        isLoading: isListLoading,
        selectionIdentity: activeSelectionIdentityRef.current,
        statusFilter: activeStatusFilterRef.current,
      },
    [getCurrentScopeSnapshot, isListLoading],
  );

  useLayoutEffect(() => {
    const previousContext = committedOperationContextRef.current;
    const selectionChanged = !isSameSelectionIdentity(
      previousContext.selectionIdentity,
      selectionIdentity,
    );
    const statusFilterChanged = previousContext.statusFilter !== statusFilter;
    const reloadCommentsChanged =
      previousContext.reloadComments !== reloadComments;
    const contextChanges = {
      reloadCommentsChanged,
      selectionChanged,
      statusFilterChanged,
    };

    activeSelectionIdentityRef.current = selectionIdentity;
    const sharedSnapshot = getCurrentScopeSnapshot?.();
    activeListCollectionRevisionRef.current =
      sharedSnapshot?.revision ?? listCollectionRevision;
    activeReloadCommentsRef.current = reloadComments;
    activeStatusFilterRef.current = statusFilter;
    if (statusFilterChanged) {
      activeStatusFilterGenerationRef.current += 1;
    }
    if (selectionChanged || statusFilterChanged) {
      activeCommentsRef.current = sharedSnapshot?.comments ?? [];
    } else if (!isListLoading) {
      activeCommentsRef.current = sharedSnapshot?.comments ?? currentComments;
    }

    committedOperationContextRef.current = {
      reloadComments,
      selectionIdentity,
      statusFilter,
    };

    if (!hasOperationContextChanged(contextChanges)) {
      return;
    }

    operationRequestIdRef.current += 1;
    dispatchOperation({ type: "operationInvalidated" });

    if (shouldInvalidateOperationData(contextChanges)) {
      dataContextVersionRef.current += 1;
      latestDataRequestByCommentRef.current.clear();
    }
  }, [
    currentComments,
    getCurrentScopeSnapshot,
    isListLoading,
    listCollectionRevision,
    reloadComments,
    selectionIdentity,
    statusFilter,
  ]);

  const beginOperation = useCallback(
    (
      operation: CommentOperationKind,
      commentId: CommentId | null,
    ): AsyncOperationToken | null => {
      if (scope === null || selectionIdentity === null) {
        return null;
      }

      const requestId = operationRequestIdRef.current + 1;
      operationRequestIdRef.current = requestId;
      if (commentId !== null) {
        latestDataRequestByCommentRef.current.set(commentId, requestId);
      }
      dispatchOperation({
        type: "operationStarted",
        operation,
        commentId,
      });

      return {
        requestId,
        dataContextVersion: dataContextVersionRef.current,
        listCollectionRevision: readCurrentScopeSnapshot().revision,
        commentId,
        selectionIdentity,
        statusFilter,
        statusFilterGeneration: activeStatusFilterGenerationRef.current,
      };
    },
    [readCurrentScopeSnapshot, scope, selectionIdentity, statusFilter],
  );

  const canApplyOperationData = useCallback(
    (token: AsyncOperationToken): boolean =>
      isDataOperationOwner(token, {
        dataContextVersion: dataContextVersionRef.current,
        latestDataRequestByComment: latestDataRequestByCommentRef.current,
        selectionIdentity: activeSelectionIdentityRef.current,
      }),
    [],
  );

  const canApplyOperationState = useCallback(
    (token: AsyncOperationToken): boolean =>
      token.requestId === operationRequestIdRef.current,
    [],
  );

  const isOperationStatusFilterCurrent = useCallback(
    (token: AsyncOperationToken): boolean =>
      token.statusFilter === activeStatusFilterRef.current &&
      token.statusFilterGeneration === activeStatusFilterGenerationRef.current,
    [],
  );

  const updateVisibleComments = useCallback(
    (transform: CommentListTransform): void => {
      const currentSnapshot = readCurrentScopeSnapshot();
      const nextActiveComments = transform(currentSnapshot.comments);
      if (nextActiveComments === currentSnapshot.comments) {
        activeCommentsRef.current = currentSnapshot.comments;
        return;
      }

      activeCommentsRef.current = nextActiveComments;
      updateCurrentScopeComments(() => nextActiveComments);
    },
    [readCurrentScopeSnapshot, updateCurrentScopeComments],
  );

  /**
   * @param token - Operation ownership captured before the command.
   * @param response - Decoded add command response.
   * @param expectation - Anchor and body submitted to the command.
   * @param previousComments - Visible collection captured before the command.
   * @returns Reconciled created aggregate.
   * @throws Error when the response violates creation invariants.
   */
  const reconcileCreationResponse = useCallback(
    async (
      token: AsyncOperationToken,
      response: Comment,
      expectation: ReconcileCommentCreationInput,
      previousComments: readonly Comment[],
    ): Promise<Comment> => {
      const reconciled = requireReconciliation(
        "add",
        Comments.appendDisplayable(
          previousComments,
          response,
          expectation,
          token.statusFilter,
        ),
      );

      if (!isOperationStatusFilterCurrent(token)) {
        await activeReloadCommentsRef.current();
        return reconciled.comment;
      }

      const applied = requireReconciliation(
        "add",
        Comments.appendDisplayable(
          readCurrentScopeSnapshot().comments,
          response,
          expectation,
          token.statusFilter,
        ),
      );
      updateVisibleComments(() => applied.comments);
      return applied.comment;
    },
    [
      isOperationStatusFilterCurrent,
      readCurrentScopeSnapshot,
      updateVisibleComments,
    ],
  );

  /**
   * @param token - Operation ownership captured before the command.
   * @param operation - Revision command being reconciled.
   * @param response - Decoded revision command response.
   * @param input - Expected id and operation-specific field changes.
   * @param previousComments - Visible collection captured before the command.
   * @returns Reconciled revised aggregate.
   * @throws Error when the response violates revision invariants.
   */
  const reconcileRevisionResponse = useCallback(
    async (
      token: AsyncOperationToken,
      operation: CommentRevisionOperationKind,
      response: Comment,
      input: ReconcileCommentRevisionInput,
      previousComments: readonly Comment[],
    ): Promise<Comment> => {
      const reconciled = requireReconciliation(
        operation,
        Comments.replaceExistingDisplayable(
          previousComments,
          response,
          input,
          token.statusFilter,
        ),
      );

      if (!isOperationStatusFilterCurrent(token)) {
        await activeReloadCommentsRef.current();
        return reconciled.comment;
      }

      const applied = requireReconciliation(
        operation,
        Comments.applyValidatedRevision(readCurrentScopeSnapshot().comments, {
          response: reconciled.comment,
          revision: input,
          previousComments,
          statusFilter: token.statusFilter,
        }),
      );
      updateVisibleComments(() => applied.comments);
      return applied.comment;
    },
    [
      isOperationStatusFilterCurrent,
      readCurrentScopeSnapshot,
      updateVisibleComments,
    ],
  );

  const markOperationSucceeded = useCallback(
    (token: AsyncOperationToken): void => {
      if (!canApplyOperationState(token)) {
        return;
      }

      dispatchOperation({ type: "operationSucceeded" });
    },
    [canApplyOperationState],
  );

  const markOperationFailed = useCallback(
    (
      token: AsyncOperationToken,
      operation: CommentOperationKind,
      commentId: CommentId | null,
      error: unknown,
    ): void => {
      if (!canApplyOperationState(token)) {
        return;
      }

      dispatchOperation({
        type: "operationFailed",
        operation,
        commentId,
        error: toCommentFeatureError(operation, error),
      });
    },
    [canApplyOperationState],
  );

  const addComment = useCallback(
    async (input: AddCommentInput): Promise<Comment | null> => {
      const token = beginOperation("add", null);
      if (token === null || scope === null) {
        return null;
      }

      const expectation = {
        anchor: input.anchor,
        body: input.body,
      };
      const previousComments = readCurrentScopeSnapshot().comments;

      try {
        const comment = await addCommentViaGateway(commands, scope, {
          anchor: input.anchor,
          body: input.body,
        });

        if (!canApplyOperationData(token)) {
          return null;
        }

        const reconciledComment = await reconcileCreationResponse(
          token,
          comment,
          expectation,
          previousComments,
        );
        if (!canApplyOperationData(token)) {
          return null;
        }

        markOperationSucceeded(token);
        return reconciledComment;
      } catch (error) {
        if (!canApplyOperationData(token)) {
          return null;
        }

        if (!isOperationStatusFilterCurrent(token)) {
          return null;
        }

        markOperationFailed(token, "add", null, error);
        return null;
      }
    },
    [
      beginOperation,
      canApplyOperationData,
      commands,
      isOperationStatusFilterCurrent,
      markOperationFailed,
      markOperationSucceeded,
      scope,
      reconcileCreationResponse,
      readCurrentScopeSnapshot,
    ],
  );

  const updateComment = useCallback(
    async (input: UpdateCommentInput): Promise<Comment | null> => {
      const token = beginOperation("update", input.commentId);
      if (token === null || scope === null) {
        return null;
      }

      const reconciliationInput = {
        commentId: input.commentId,
        revision: {
          kind: "update",
          body: input.body,
        },
      } as const;
      const previousComments = readCurrentScopeSnapshot().comments;

      try {
        const comment = await updateCommentViaGateway(commands, scope, {
          commentId: input.commentId,
          body: input.body,
        });

        if (!canApplyOperationData(token)) {
          return null;
        }

        const reconciledComment = await reconcileRevisionResponse(
          token,
          "update",
          comment,
          reconciliationInput,
          previousComments,
        );
        if (!canApplyOperationData(token)) {
          return null;
        }

        markOperationSucceeded(token);
        return reconciledComment;
      } catch (error) {
        if (!canApplyOperationData(token)) {
          return null;
        }

        if (!isOperationStatusFilterCurrent(token)) {
          return null;
        }

        markOperationFailed(token, "update", input.commentId, error);
        return null;
      }
    },
    [
      beginOperation,
      canApplyOperationData,
      commands,
      isOperationStatusFilterCurrent,
      markOperationFailed,
      markOperationSucceeded,
      scope,
      reconcileRevisionResponse,
      readCurrentScopeSnapshot,
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

        if (!canApplyOperationData(token)) {
          return false;
        }

        if (!response.deleted) {
          markOperationSucceeded(token);
          return false;
        }

        if (isOperationStatusFilterCurrent(token)) {
          updateVisibleComments((comments) =>
            Comments.remove(comments, commentId),
          );
        }
        markOperationSucceeded(token);
        await activeReloadCommentsRef.current();
        return true;
      } catch (error) {
        if (!canApplyOperationData(token)) {
          return false;
        }

        if (!isOperationStatusFilterCurrent(token)) {
          return false;
        }

        markOperationFailed(token, "delete", commentId, error);
        return false;
      }
    },
    [
      beginOperation,
      canApplyOperationData,
      commands,
      isOperationStatusFilterCurrent,
      markOperationFailed,
      markOperationSucceeded,
      scope,
      updateVisibleComments,
    ],
  );

  const resolveComment = useCallback(
    async (commentId: CommentId): Promise<Comment | null> => {
      const token = beginOperation("resolve", commentId);
      if (token === null || scope === null) {
        return null;
      }

      const reconciliationInput = {
        commentId,
        revision: { kind: "resolve" },
      } as const;
      const previousComments = readCurrentScopeSnapshot().comments;

      try {
        const comment = await resolveCommentViaGateway(
          commands,
          scope,
          commentId,
        );

        if (!canApplyOperationData(token)) {
          return null;
        }

        const reconciledComment = await reconcileRevisionResponse(
          token,
          "resolve",
          comment,
          reconciliationInput,
          previousComments,
        );
        if (!canApplyOperationData(token)) {
          return null;
        }

        markOperationSucceeded(token);
        return reconciledComment;
      } catch (error) {
        if (!canApplyOperationData(token)) {
          return null;
        }

        if (!isOperationStatusFilterCurrent(token)) {
          return null;
        }

        markOperationFailed(token, "resolve", commentId, error);
        return null;
      }
    },
    [
      beginOperation,
      canApplyOperationData,
      commands,
      isOperationStatusFilterCurrent,
      markOperationFailed,
      markOperationSucceeded,
      scope,
      reconcileRevisionResponse,
      readCurrentScopeSnapshot,
    ],
  );

  const reopenComment = useCallback(
    async (commentId: CommentId): Promise<Comment | null> => {
      const token = beginOperation("reopen", commentId);
      if (token === null || scope === null) {
        return null;
      }

      const reconciliationInput = {
        commentId,
        revision: { kind: "reopen" },
      } as const;
      const previousComments = readCurrentScopeSnapshot().comments;

      try {
        const comment = await reopenCommentViaGateway(
          commands,
          scope,
          commentId,
        );

        if (!canApplyOperationData(token)) {
          return null;
        }

        const reconciledComment = await reconcileRevisionResponse(
          token,
          "reopen",
          comment,
          reconciliationInput,
          previousComments,
        );
        if (!canApplyOperationData(token)) {
          return null;
        }

        markOperationSucceeded(token);
        return reconciledComment;
      } catch (error) {
        if (!canApplyOperationData(token)) {
          return null;
        }

        if (!isOperationStatusFilterCurrent(token)) {
          return null;
        }

        markOperationFailed(token, "reopen", commentId, error);
        return null;
      }
    },
    [
      beginOperation,
      canApplyOperationData,
      commands,
      isOperationStatusFilterCurrent,
      markOperationFailed,
      markOperationSucceeded,
      scope,
      reconcileRevisionResponse,
      readCurrentScopeSnapshot,
    ],
  );

  const toggleCommentResolved = useCallback(
    async (commentId: CommentId): Promise<Comment | null> => {
      const token = beginOperation("toggle", commentId);
      if (token === null || scope === null) {
        return null;
      }

      const previousComments = readCurrentScopeSnapshot().comments;
      const currentComment = Comments.findById(previousComments, commentId);
      if (currentComment === undefined) {
        markOperationFailed(
          token,
          "toggle",
          commentId,
          new Error("Cannot toggle a comment outside the active collection"),
        );
        return null;
      }

      const expectedStatus = CommentAggregate.isResolved(currentComment)
        ? "open"
        : "resolved";
      const reconciliationInput = {
        commentId,
        revision: { kind: "toggle", status: expectedStatus },
      } as const;
      const optimisticComments = Comments.upsertOptimisticToggle(
        previousComments,
        commentId,
        token.statusFilter,
      );
      updateVisibleComments(() => optimisticComments);

      try {
        const comment = await toggleCommentResolvedViaGateway(
          commands,
          scope,
          commentId,
        );

        if (!canApplyOperationData(token)) {
          return null;
        }

        const reconciledComment = await reconcileRevisionResponse(
          token,
          "toggle",
          comment,
          reconciliationInput,
          previousComments,
        );
        if (!canApplyOperationData(token)) {
          return null;
        }

        markOperationSucceeded(token);
        return reconciledComment;
      } catch (error) {
        if (!canApplyOperationData(token)) {
          return null;
        }

        if (!isOperationStatusFilterCurrent(token)) {
          return null;
        }

        if (
          readCurrentScopeSnapshot().revision === token.listCollectionRevision
        ) {
          const rolledBackComments = Comments.rollbackOptimisticToggle(
            readCurrentScopeSnapshot().comments,
            {
              commentId,
              previousComments,
              optimisticComments,
              statusFilter: token.statusFilter,
            },
          );
          updateVisibleComments(() => rolledBackComments);
        }
        markOperationFailed(token, "toggle", commentId, error);
        return null;
      }
    },
    [
      beginOperation,
      canApplyOperationData,
      commands,
      isOperationStatusFilterCurrent,
      markOperationFailed,
      markOperationSucceeded,
      scope,
      updateVisibleComments,
      reconcileRevisionResponse,
      readCurrentScopeSnapshot,
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

type SuccessfulReconciliation = Extract<
  CommentsReconciliationResult,
  Readonly<{ ok: true }>
>["value"];

/**
 * @param operation - Operation whose response is being reconciled.
 * @param result - Aggregate reconciliation result.
 * @returns Reconciled collection and aggregate.
 * @throws Error when the command response violates an aggregate invariant.
 */
function requireReconciliation(
  operation: CommentOperationKind,
  result: CommentsReconciliationResult,
): SuccessfulReconciliation {
  if (!result.ok) {
    throw new Error(
      `Rejected ${operation} comment response: ${result.error.reason}`,
    );
  }

  return result.value;
}

/**
 * @param _state - Current operation state.
 * @param event - Operation lifecycle event.
 * @returns Next operation state.
 */
function commentOperationReducer(
  _state: CommentOperationFeatureState,
  event: CommentOperationEvent,
): CommentOperationFeatureState {
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
 * @param token - Captured operation token.
 * @param context - Current data context and per-comment ownership.
 * @returns True when the async operation still owns its target data.
 */
function isDataOperationOwner(
  token: AsyncOperationToken,
  context: DataOperationOwnershipContext,
): boolean {
  if (token.dataContextVersion !== context.dataContextVersion) {
    return false;
  }

  if (
    !isSameSelectionIdentity(token.selectionIdentity, context.selectionIdentity)
  ) {
    return false;
  }

  if (token.commentId === null) {
    return true;
  }

  return (
    context.latestDataRequestByComment.get(token.commentId) === token.requestId
  );
}

/**
 * @param left - First nullable selection identity.
 * @param right - Second nullable selection identity.
 * @returns True when both identities refer to the same committed selection.
 */
function isSameSelectionIdentity(
  left: SelectionIdentityType | null,
  right: SelectionIdentityType | null,
): boolean {
  if (left === null) {
    return right === null;
  }

  if (right === null) {
    return false;
  }

  return SelectionIdentity.equals(left, right);
}

/**
 * @param changes - Changes detected between committed operation contexts.
 * @returns True when operation UI ownership must be invalidated.
 */
function hasOperationContextChanged(changes: OperationContextChanges): boolean {
  if (changes.selectionChanged) {
    return true;
  }

  if (changes.statusFilterChanged) {
    return true;
  }

  return changes.reloadCommentsChanged;
}

/**
 * @param changes - Changes detected between committed operation contexts.
 * @returns True when pending operation data no longer belongs to the context.
 */
function shouldInvalidateOperationData(
  changes: OperationContextChanges,
): boolean {
  if (changes.selectionChanged) {
    return true;
  }

  if (changes.statusFilterChanged) {
    return false;
  }

  return changes.reloadCommentsChanged;
}
