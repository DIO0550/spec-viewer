import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  commentCommands as defaultCommentCommands,
  normalizeCommandError,
  type CommentCommands,
} from "@/shared/api/tauri";
import {
  createPerformanceCorrelationId,
  startPerformanceSpan,
} from "@/shared/lib/performance";
import { Comment } from "@/features/comments/domain/comment";
import { CommentScope } from "@/features/comments/domain/commentScope";
import { CommentStatusFilter } from "@/features/comments/domain/commentStatusFilter";
import type {
  AddCommentRequest,
  CommentAnchor,
  CommentId,
  CommentStatusRequest,
  DeleteCommentResponse,
  ListCommentsRequest,
  UpdateCommentRequest,
} from "@/features/comments/types/comment";
import type { NormalizedCommandError } from "@/shared/types/ipc";
import type { SpecFileKey } from "@/features/specs/types/spec";

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

export type CommentMutationOperation =
  | "add"
  | "update"
  | "delete"
  | "resolve"
  | "reopen"
  | "toggle";

export type CommentMutationState =
  | Readonly<{
      status: "idle";
      operation: null;
      commentId: null;
      error: null;
    }>
  | Readonly<{
      status: "saving";
      operation: CommentMutationOperation;
      commentId: CommentId | null;
      error: null;
    }>
  | Readonly<{
      status: "error";
      operation: CommentMutationOperation;
      commentId: CommentId | null;
      error: NormalizedCommandError;
    }>;

export type AddCommentInput = Readonly<{
  anchor: CommentAnchor;
  body: string;
}>;

export type UpdateCommentInput = Readonly<{
  commentId: CommentId;
  body: string;
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

const initialMutationState: CommentMutationState = {
  status: "idle",
  operation: null,
  commentId: null,
  error: null,
};

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
  const mutationRequestIdRef = useRef(0);
  const activeScopeKeyRef = useRef(scopeKey);
  const [listState, setListState] = useState<CommentListState>(
    createIdleListState(),
  );
  const [mutationState, setMutationState] =
    useState<CommentMutationState>(initialMutationState);

  activeScopeKeyRef.current = scopeKey;

  const isLatestMutationRequest = useCallback(
    (requestId: number): boolean => mutationRequestIdRef.current === requestId,
    [],
  );
  const isLatestListRequest = useCallback(
    (requestId: number): boolean => listRequestIdRef.current === requestId,
    [],
  );
  const isSameScopeResult = useCallback(
    (expectedScopeKey: string): boolean =>
      activeScopeKeyRef.current === expectedScopeKey,
    [],
  );
  const canApplyMutationResult = useCallback(
    (token: AsyncMutationToken): boolean =>
      isLatestMutationRequest(token.requestId) &&
      isSameScopeResult(token.scopeKey),
    [isLatestMutationRequest, isSameScopeResult],
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
  const runCommentMutation = useCallback(
    async <Result,>(
      request: CommentMutationRequest<Result>,
    ): Promise<Result | null> => {
      if (scope === null) {
        return null;
      }

      const activeScope = scope;
      const activeScopeKey = scopeKey;
      const requestId = mutationRequestIdRef.current + 1;
      mutationRequestIdRef.current = requestId;
      setMutationState({
        status: "saving",
        operation: request.operation,
        commentId: request.commentId,
        error: null,
      });

      try {
        const result = await request.run(activeScope);

        if (
          !canApplyMutationResult({
            requestId,
            scopeKey: activeScopeKey,
          })
        ) {
          return null;
        }

        request.applySuccess?.(result);
        setMutationState(initialMutationState);
        return result;
      } catch (error) {
        if (
          !canApplyMutationResult({
            requestId,
            scopeKey: activeScopeKey,
          })
        ) {
          return null;
        }

        request.applyFailure?.();
        setMutationState({
          status: "error",
          operation: request.operation,
          commentId: request.commentId,
          error: normalizeCommandError(error),
        });
        return null;
      }
    },
    [canApplyMutationResult, scope, scopeKey],
  );
  const runStatusMutation = useCallback(
    async (request: StatusCommentMutationRequest): Promise<Comment | null> =>
      runCommentMutation({
        ...request,
        applySuccess: (comment) => {
          updateCurrentScopeComments((comments) =>
            Comment.upsertDisplayable(comments, comment, statusFilter),
          );
        },
      }),
    [runCommentMutation, statusFilter, updateCurrentScopeComments],
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
      const response = await commands.listComments(
        createListCommentsRequest(
          activeScope,
          statusFilter,
          options.correlationId ?? null,
        ),
      );
      endSpan({
        commentCount: response.comments.length,
      });

      if (
        !isLatestListRequest(requestId) ||
        !isSameScopeResult(requestScopeKey)
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
        !isSameScopeResult(requestScopeKey)
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
    isSameScopeResult,
    options.correlationId,
    scope,
    scopeKey,
    statusFilter,
  ]);

  useEffect(() => {
    mutationRequestIdRef.current += 1;
    setMutationState(initialMutationState);
    void reloadComments();
  }, [reloadComments]);

  const addComment = useCallback(
    async (input: AddCommentInput): Promise<Comment | null> =>
      runCommentMutation({
        operation: "add",
        commentId: null,
        run: async (activeScope) => {
          const request: AddCommentRequest = {
            workspacePath: activeScope.workspacePath,
            specId: activeScope.specId,
            anchor: input.anchor,
            body: input.body,
          };
          return commands.addComment(request);
        },
        applySuccess: (comment) => {
          updateCurrentScopeComments((comments) =>
            Comment.appendDisplayable(comments, comment, statusFilter),
          );
        },
      }),
    [commands, runCommentMutation, statusFilter, updateCurrentScopeComments],
  );

  const updateComment = useCallback(
    async (input: UpdateCommentInput): Promise<Comment | null> =>
      runCommentMutation({
        operation: "update",
        commentId: input.commentId,
        run: async (activeScope) => {
          const request: UpdateCommentRequest = {
            ...createStatusRequest(activeScope, input.commentId),
            body: input.body,
          };
          return commands.updateComment(request);
        },
        applySuccess: (comment) => {
          updateCurrentScopeComments((comments) =>
            Comment.upsertDisplayable(comments, comment, statusFilter),
          );
        },
      }),
    [commands, runCommentMutation, statusFilter, updateCurrentScopeComments],
  );

  const deleteComment = useCallback(
    async (commentId: CommentId): Promise<boolean> => {
      const response = await runCommentMutation<DeleteCommentResponse>({
        operation: "delete",
        commentId,
        run: (activeScope) =>
          commands.deleteComment(createStatusRequest(activeScope, commentId)),
        applySuccess: () => {
          updateCurrentScopeComments((comments) =>
            comments.filter((comment) => comment.id !== commentId),
          );
        },
      });

      if (response === null || !response.deleted) {
        return false;
      }

      await reloadComments();
      return true;
    },
    [commands, reloadComments, runCommentMutation, updateCurrentScopeComments],
  );

  const resolveComment = useCallback(
    async (commentId: CommentId): Promise<Comment | null> =>
      runStatusMutation({
        operation: "resolve",
        commentId,
        run: (activeScope) =>
          commands.resolveComment(createStatusRequest(activeScope, commentId)),
      }),
    [commands, runStatusMutation],
  );

  const reopenComment = useCallback(
    async (commentId: CommentId): Promise<Comment | null> =>
      runStatusMutation({
        operation: "reopen",
        commentId,
        run: (activeScope) =>
          commands.reopenComment(createStatusRequest(activeScope, commentId)),
      }),
    [commands, runStatusMutation],
  );

  const toggleCommentResolved = useCallback(
    async (commentId: CommentId): Promise<Comment | null> => {
      const previousComments = listState.comments;

      updateCurrentScopeComments((comments) =>
        Comment.upsertOptimisticToggle(comments, commentId, statusFilter),
      );

      return runStatusMutation({
        operation: "toggle",
        commentId,
        run: (activeScope) =>
          commands.toggleCommentResolved(
            createStatusRequest(activeScope, commentId),
          ),
        applyFailure: () => {
          updateCurrentScopeComments(() => previousComments);
        },
      });
    },
    [
      commands,
      listState.comments,
      runStatusMutation,
      statusFilter,
      updateCurrentScopeComments,
    ],
  );

  return {
    listState,
    mutationState,
    comments: listState.comments,
    isLoading: listState.status === "loading",
    isSaving: mutationState.status === "saving",
    isEmpty: listState.status === "empty",
    error: listState.error,
    mutationError: mutationState.error,
    reloadComments,
    addComment,
    updateComment,
    deleteComment,
    resolveComment,
    reopenComment,
    toggleCommentResolved,
  };
}

type CommentMutationRequest<Result> = Readonly<{
  operation: CommentMutationOperation;
  commentId: CommentId | null;
  run: (scope: CommentScope) => Promise<Result>;
  applySuccess?: (result: Result) => void;
  applyFailure?: () => void;
}>;

type StatusCommentMutationRequest = Omit<
  CommentMutationRequest<Comment>,
  "applySuccess"
>;

type AsyncMutationToken = Readonly<{
  requestId: number;
  scopeKey: string;
}>;

type CommentListTransform = (
  comments: readonly Comment[],
) => readonly Comment[];

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

/** @returns IPC list request for the selected comment scope. */
function createListCommentsRequest(
  scope: CommentScope,
  statusFilter: CommentStatusFilter,
  correlationId: string | null,
): ListCommentsRequest {
  const request: ListCommentsRequest = {
    ...scope,
    statusFilter: CommentStatusFilter.toString(statusFilter),
  };

  if (correlationId === null) {
    return request;
  }

  return {
    ...request,
    correlationId,
  };
}

/** @returns IPC status request for commands targeting one comment. */
function createStatusRequest(
  scope: CommentScope,
  commentId: CommentId,
): CommentStatusRequest {
  return {
    ...scope,
    commentId,
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
