import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  commentCommands as defaultCommentCommands,
  normalizeCommandError,
  type CommentCommands,
} from "@/shared/api/tauri";
import {
  createPerformanceCorrelationId,
  startPerformanceSpan,
} from "@/shared/lib/performance";
import { CommentScope } from "@/features/comments/domain/commentScope";
import { CommentStatusFilter } from "@/features/comments/domain/commentStatusFilter";
import { listComments as listCommentsViaGateway } from "@/features/comments/infra/commentGateway";
import {
  useCommentMutations,
  type AddCommentInput,
  type CommentListTransform,
  type CommentMutationState,
  type UpdateCommentInput,
} from "@/features/comments/hooks/useCommentMutations";
import type { CommentId } from "@/features/comments/types/comment";
import type { Comment } from "@/features/comments/types/comment";
import type { NormalizedCommandError } from "@/shared/types/ipc";
import type { SpecFileKey } from "@/features/specs/types/spec";

export type {
  AddCommentInput,
  CommentListTransform,
  CommentMutationOperation,
  CommentMutationState,
  CommentOperationKind,
  CommentOperationState,
  UpdateCommentInput,
} from "@/features/comments/hooks/useCommentMutations";

export type CommentListState =
  | Readonly<{
      status: "idle";
      comments: readonly [];
      error: null;
    }>
  | Readonly<{
      status: "loading";
      comments: readonly [];
      error: null;
    }>
  | Readonly<{
      status: "ready";
      comments: readonly Comment[];
      error: null;
    }>
  | Readonly<{
      status: "empty";
      comments: readonly [];
      error: null;
    }>
  | Readonly<{
      status: "error";
      comments: readonly [];
      error: NormalizedCommandError;
    }>;

export type UseCommentsOptions = Readonly<{
  workspacePath: string | null;
  specId: string | null;
  fileKey: SpecFileKey | null;
  statusFilter?: CommentStatusFilter | null;
  correlationId?: string | null;
  commands?: CommentCommands;
}>;

export type UseCommentsResult = Readonly<{
  listState: CommentListState;
  mutationState: CommentMutationState;
  comments: readonly Comment[];
  isLoading: boolean;
  isSaving: boolean;
  isEmpty: boolean;
  error: NormalizedCommandError | null;
  mutationError: NormalizedCommandError | null;
  reloadComments: () => Promise<boolean>;
  addComment: (input: AddCommentInput) => Promise<Comment | null>;
  updateComment: (input: UpdateCommentInput) => Promise<Comment | null>;
  deleteComment: (commentId: CommentId) => Promise<boolean>;
  resolveComment: (commentId: CommentId) => Promise<Comment | null>;
  reopenComment: (commentId: CommentId) => Promise<Comment | null>;
  toggleCommentResolved: (commentId: CommentId) => Promise<Comment | null>;
}>;

const defaultStatusFilter: CommentStatusFilter = CommentStatusFilter.All;

/** @returns Comment loading and mutation state for the selected spec file. */
export function useComments(options: UseCommentsOptions): UseCommentsResult {
  const statusFilter =
    CommentStatusFilter.parse(options.statusFilter) ?? defaultStatusFilter;
  const commands = options.commands ?? defaultCommentCommands;
  const scope = useMemo(
    () =>
      CommentScope.create({
        workspacePath: options.workspacePath,
        specId: options.specId,
        fileKey: options.fileKey,
      }),
    [options.fileKey, options.specId, options.workspacePath],
  );
  const scopeKey = createScopeKey(scope, statusFilter);
  const listRequestIdRef = useRef(0);
  const activeListScopeKeyRef = useRef(scopeKey);
  const [listState, setListState] = useState<CommentListState>(
    createIdleListState(),
  );

  activeListScopeKeyRef.current = scopeKey;

  const isLatestListRequest = useCallback(
    (requestId: number): boolean => listRequestIdRef.current === requestId,
    [],
  );
  const isSameListScopeResult = useCallback(
    (expectedScopeKey: string): boolean =>
      activeListScopeKeyRef.current === expectedScopeKey,
    [],
  );
  const updateCurrentScopeComments = useCallback(
    (transform: CommentListTransform): void => {
      setListState((currentState) => {
        if (currentState.status === "idle") {
          return currentState;
        }

        const nextComments = transform(currentState.comments);

        if (
          currentState.status === "loading" &&
          nextComments !== currentState.comments
        ) {
          listRequestIdRef.current += 1;
        }

        return createLoadedListState(nextComments);
      });
    },
    [],
  );

  const reloadComments = useCallback(async (): Promise<boolean> => {
    const activeScope = scope;

    if (activeScope === null) {
      listRequestIdRef.current += 1;
      setListState(createIdleListState());
      return true;
    }

    const requestId = listRequestIdRef.current + 1;
    const requestScopeKey = scopeKey;
    listRequestIdRef.current = requestId;
    setListState({
      status: "loading",
      comments: [],
      error: null,
    });

    const correlationId =
      options.correlationId ?? createPerformanceCorrelationId("comments-list");
    const endSpan = startPerformanceSpan(correlationId, "comments.list", {
      specId: activeScope.specId,
      fileKey: activeScope.fileKey,
      statusFilter,
    });

    try {
      const response = await listCommentsViaGateway(
        commands,
        activeScope,
        statusFilter,
        options.correlationId ?? null,
      );
      endSpan({
        commentCount: response.comments.length,
      });

      if (
        !isLatestListRequest(requestId) ||
        !isSameListScopeResult(requestScopeKey)
      ) {
        return false;
      }

      setListState(createLoadedListState(response.comments));
      return true;
    } catch (error) {
      endSpan({
        error: true,
      });

      if (
        !isLatestListRequest(requestId) ||
        !isSameListScopeResult(requestScopeKey)
      ) {
        return false;
      }

      setListState({
        status: "error",
        comments: [],
        error: normalizeCommandError(error),
      });
      return false;
    }
  }, [
    commands,
    isLatestListRequest,
    isSameListScopeResult,
    options.correlationId,
    scope,
    scopeKey,
    statusFilter,
  ]);

  useEffect(() => {
    void reloadComments();
  }, [reloadComments]);

  const commentOperations = useCommentMutations({
    scope,
    scopeKey,
    statusFilter,
    commands,
    currentComments: listState.comments,
    updateCurrentScopeComments,
    reloadComments,
  });

  return {
    listState,
    mutationState: commentOperations.operationState,
    comments: listState.comments,
    isLoading: listState.status === "loading",
    isSaving: commentOperations.operationState.status === "saving",
    isEmpty: listState.status === "empty",
    error: listState.error,
    mutationError: commentOperations.operationState.error,
    reloadComments,
    addComment: commentOperations.addComment,
    updateComment: commentOperations.updateComment,
    deleteComment: commentOperations.deleteComment,
    resolveComment: commentOperations.resolveComment,
    reopenComment: commentOperations.reopenComment,
    toggleCommentResolved: commentOperations.toggleCommentResolved,
  };
}

/** @returns Idle comment list state for an incomplete scope. */
function createIdleListState(): CommentListState {
  return {
    status: "idle",
    comments: [],
    error: null,
  };
}

/** @returns Loaded comment list state, using empty when no comments are present. */
function createLoadedListState(comments: readonly Comment[]): CommentListState {
  if (comments.length === 0) {
    return {
      status: "empty",
      comments: [],
      error: null,
    };
  }

  return {
    status: "ready",
    comments,
    error: null,
  };
}

/** @returns Scope identity for stale mutation guards. */
function createScopeKey(
  scope: CommentScope | null,
  statusFilter: CommentStatusFilter,
): string {
  if (scope === null) {
    return `idle:${statusFilter}`;
  }

  return `${scope.workspacePath}:${scope.specId}:${scope.fileKey}:${statusFilter}`;
}
