import { useCallback, useEffect, useRef, useState } from "react";

import { listComments as listCommentsViaGateway } from "@/features/comments/infra/commentGateway";
import {
  createPerformanceCorrelationId,
  startPerformanceSpan,
} from "@/shared/lib/performance";
import {
  normalizeCommandError,
  type CommentCommands,
} from "@/shared/api/tauri";
import type { CommentScope } from "@/features/comments/domain/commentScope";
import type { CommentStatusFilter } from "@/features/comments/domain/commentStatusFilter";
import type { Comment } from "@/features/comments/types/comment";
import type { NormalizedCommandError } from "@/shared/types/ipc";

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

export type CommentListTransform = (
  comments: readonly Comment[],
) => readonly Comment[];

export type UseCommentListOptions = Readonly<{
  scope: CommentScope | null;
  statusFilter: CommentStatusFilter;
  commands: CommentCommands;
  correlationId?: string | null;
}>;

export type UseCommentListResult = Readonly<{
  listState: CommentListState;
  scopeKey: string;
  reloadComments: () => Promise<boolean>;
  updateCurrentScopeComments: (transform: CommentListTransform) => void;
}>;

/** @returns Comment list state machine for the active comment scope. */
export function useCommentList(
  options: UseCommentListOptions,
): UseCommentListResult {
  const { commands, correlationId, scope, statusFilter } = options;
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

    const performanceCorrelationId =
      correlationId ?? createPerformanceCorrelationId("comments-list");
    const endSpan = startPerformanceSpan(
      performanceCorrelationId,
      "comments.list",
      {
        specId: activeScope.specId,
        fileKey: activeScope.fileKey,
        statusFilter,
      },
    );

    try {
      const response = await listCommentsViaGateway(
        commands,
        activeScope,
        statusFilter,
        correlationId ?? null,
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
    correlationId,
    isLatestListRequest,
    isSameListScopeResult,
    scope,
    scopeKey,
    statusFilter,
  ]);

  useEffect(() => {
    void reloadComments();
  }, [reloadComments]);

  return {
    listState,
    scopeKey,
    reloadComments,
    updateCurrentScopeComments,
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
