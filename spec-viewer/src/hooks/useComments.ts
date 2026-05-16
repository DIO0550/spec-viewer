import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";

import {
  commentCommands as defaultCommentCommands,
  normalizeCommandError,
  type CommentCommands,
} from "../lib/tauri";
import {
  createPerformanceCorrelationId,
  startPerformanceSpan,
} from "../lib/performance";
import type {
  AddCommentRequest,
  Comment,
  CommentAnchor,
  CommentId,
  CommentStatusFilter,
  CommentStatusRequest,
  DeleteCommentResponse,
  ListCommentsRequest,
  UpdateCommentRequest,
} from "../types/comment";
import type { NormalizedCommandError } from "../types/ipc";
import type { SpecFileKey } from "../types/spec";

export type CommentScope = Readonly<{
  workspacePath: string;
  specId: string;
  fileKey: SpecFileKey;
}>;

export type CommentListState =
  | Readonly<{
      status: "idle";
      scope: null;
      statusFilter: CommentStatusFilter;
      comments: readonly [];
      error: null;
    }>
  | Readonly<{
      status: "loading";
      scope: CommentScope;
      statusFilter: CommentStatusFilter;
      comments: readonly [];
      error: null;
    }>
  | Readonly<{
      status: "ready";
      scope: CommentScope;
      statusFilter: CommentStatusFilter;
      comments: readonly Comment[];
      error: null;
    }>
  | Readonly<{
      status: "empty";
      scope: CommentScope;
      statusFilter: CommentStatusFilter;
      comments: readonly [];
      error: null;
    }>
  | Readonly<{
      status: "error";
      scope: CommentScope;
      statusFilter: CommentStatusFilter;
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

const defaultStatusFilter: CommentStatusFilter = "all";

const initialMutationState: CommentMutationState = {
  status: "idle",
  operation: null,
  commentId: null,
  error: null,
};

/** @returns Comment loading and mutation state for the selected spec file. */
export function useComments(options: UseCommentsOptions): UseCommentsResult {
  const statusFilter = options.statusFilter ?? defaultStatusFilter;
  const commands = options.commands ?? defaultCommentCommands;
  const scope = useMemo(
    () =>
      createCommentScope({
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
  const commentsRef = useRef<readonly Comment[]>([]);
  const [listState, setListState] = useState<CommentListState>(
    createIdleListState(statusFilter),
  );
  const [mutationState, setMutationState] =
    useState<CommentMutationState>(initialMutationState);

  activeScopeKeyRef.current = scopeKey;

  useEffect(() => {
    commentsRef.current = listState.comments;
  }, [listState.comments]);

  const reloadComments = useCallback(async (): Promise<boolean> => {
    const activeScope = scope;

    if (activeScope === null) {
      listRequestIdRef.current += 1;
      setListState(createIdleListState(statusFilter));
      return true;
    }

    const requestId = listRequestIdRef.current + 1;
    listRequestIdRef.current = requestId;
    setListState({
      status: "loading",
      scope: activeScope,
      statusFilter,
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

      if (listRequestIdRef.current !== requestId) {
        return false;
      }

      setListState(
        createLoadedListState(activeScope, statusFilter, response.comments),
      );
      return true;
    } catch (error) {
      endSpan({
        error: true,
      });

      if (listRequestIdRef.current !== requestId) {
        return false;
      }

      setListState({
        status: "error",
        scope: activeScope,
        statusFilter,
        comments: [],
        error: normalizeCommandError(error),
      });
      return false;
    }
  }, [commands, options.correlationId, scope, statusFilter]);

  useEffect(() => {
    mutationRequestIdRef.current += 1;
    setMutationState(initialMutationState);
    void reloadComments();
  }, [reloadComments]);

  const addComment = useCallback(
    async (input: AddCommentInput): Promise<Comment | null> =>
      runCommentMutation({
        scope,
        scopeKey,
        activeScopeKeyRef,
        mutationRequestIdRef,
        operation: "add",
        commentId: null,
        setMutationState,
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
          updateCommentsForCurrentScope({
            scope,
            statusFilter,
            setListState,
            transform: (comments) =>
              appendDisplayableComment(comments, comment, statusFilter),
          });
        },
      }),
    [commands, scope, scopeKey, statusFilter],
  );

  const updateComment = useCallback(
    async (input: UpdateCommentInput): Promise<Comment | null> =>
      runCommentMutation({
        scope,
        scopeKey,
        activeScopeKeyRef,
        mutationRequestIdRef,
        operation: "update",
        commentId: input.commentId,
        setMutationState,
        run: async (activeScope) => {
          const request: UpdateCommentRequest = {
            ...createStatusRequest(activeScope, input.commentId),
            body: input.body,
          };
          return commands.updateComment(request);
        },
        applySuccess: (comment) => {
          updateCommentsForCurrentScope({
            scope,
            statusFilter,
            setListState,
            transform: (comments) =>
              upsertDisplayableComment(comments, comment, statusFilter),
          });
        },
      }),
    [commands, scope, scopeKey, statusFilter],
  );

  const deleteComment = useCallback(
    async (commentId: CommentId): Promise<boolean> => {
      const response = await runCommentMutation<DeleteCommentResponse>({
        scope,
        scopeKey,
        activeScopeKeyRef,
        mutationRequestIdRef,
        operation: "delete",
        commentId,
        setMutationState,
        run: (activeScope) =>
          commands.deleteComment(createStatusRequest(activeScope, commentId)),
        applySuccess: () => {
          updateCommentsForCurrentScope({
            scope,
            statusFilter,
            setListState,
            transform: (comments) =>
              comments.filter((comment) => comment.id !== commentId),
          });
        },
      });

      if (response === null || !response.deleted) {
        return false;
      }

      await reloadComments();
      return true;
    },
    [commands, reloadComments, scope, scopeKey, statusFilter],
  );

  const resolveComment = useCallback(
    async (commentId: CommentId): Promise<Comment | null> =>
      runStatusMutation({
        scope,
        scopeKey,
        activeScopeKeyRef,
        mutationRequestIdRef,
        operation: "resolve",
        commentId,
        setMutationState,
        statusFilter,
        setListState,
        run: (activeScope) =>
          commands.resolveComment(createStatusRequest(activeScope, commentId)),
      }),
    [commands, scope, scopeKey, statusFilter],
  );

  const reopenComment = useCallback(
    async (commentId: CommentId): Promise<Comment | null> =>
      runStatusMutation({
        scope,
        scopeKey,
        activeScopeKeyRef,
        mutationRequestIdRef,
        operation: "reopen",
        commentId,
        setMutationState,
        statusFilter,
        setListState,
        run: (activeScope) =>
          commands.reopenComment(createStatusRequest(activeScope, commentId)),
      }),
    [commands, scope, scopeKey, statusFilter],
  );

  const toggleCommentResolved = useCallback(
    async (commentId: CommentId): Promise<Comment | null> => {
      const previousComments = commentsRef.current;

      updateCommentsForCurrentScope({
        scope,
        statusFilter,
        setListState,
        transform: (comments) =>
          upsertOptimisticToggle(comments, commentId, statusFilter),
      });

      return runStatusMutation({
        scope,
        scopeKey,
        activeScopeKeyRef,
        mutationRequestIdRef,
        operation: "toggle",
        commentId,
        setMutationState,
        statusFilter,
        setListState,
        run: (activeScope) =>
          commands.toggleCommentResolved(
            createStatusRequest(activeScope, commentId),
          ),
        applyFailure: () => {
          updateCommentsForCurrentScope({
            scope,
            statusFilter,
            setListState,
            transform: () => previousComments,
          });
        },
      });
    },
    [commands, scope, scopeKey, statusFilter],
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

type CreateCommentScopeOptions = Readonly<{
  workspacePath: string | null;
  specId: string | null;
  fileKey: SpecFileKey | null;
}>;

type RunCommentMutationOptions<Result> = Readonly<{
  scope: CommentScope | null;
  scopeKey: string;
  activeScopeKeyRef: MutableRefObject<string>;
  mutationRequestIdRef: MutableRefObject<number>;
  operation: CommentMutationOperation;
  commentId: CommentId | null;
  setMutationState: Dispatch<SetStateAction<CommentMutationState>>;
  run: (scope: CommentScope) => Promise<Result>;
  applySuccess?: (result: Result) => void;
  applyFailure?: () => void;
}>;

type RunStatusMutationOptions = Omit<
  RunCommentMutationOptions<Comment>,
  "applySuccess"
> &
  Readonly<{
    statusFilter: CommentStatusFilter;
    setListState: Dispatch<SetStateAction<CommentListState>>;
  }>;

type UpdateCommentsForCurrentScopeOptions = Readonly<{
  scope: CommentScope | null;
  statusFilter: CommentStatusFilter;
  setListState: Dispatch<SetStateAction<CommentListState>>;
  transform: (comments: readonly Comment[]) => readonly Comment[];
}>;

/** @returns Complete comment scope, or null when the selected file is incomplete. */
function createCommentScope(
  options: CreateCommentScopeOptions,
): CommentScope | null {
  if (
    options.workspacePath === null ||
    options.specId === null ||
    options.fileKey === null
  ) {
    return null;
  }

  return {
    workspacePath: options.workspacePath,
    specId: options.specId,
    fileKey: options.fileKey,
  };
}

/** @returns Idle comment list state for an incomplete scope. */
function createIdleListState(
  statusFilter: CommentStatusFilter,
): CommentListState {
  return {
    status: "idle",
    scope: null,
    statusFilter,
    comments: [],
    error: null,
  };
}

/** @returns Loaded comment list state, using empty when no comments are present. */
function createLoadedListState(
  scope: CommentScope,
  statusFilter: CommentStatusFilter,
  comments: readonly Comment[],
): CommentListState {
  if (comments.length === 0) {
    return {
      status: "empty",
      scope,
      statusFilter,
      comments: [],
      error: null,
    };
  }

  return {
    status: "ready",
    scope,
    statusFilter,
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
    statusFilter,
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

/** @returns Mutation result, or null when scope is absent or the command fails. */
async function runCommentMutation<Result>(
  options: RunCommentMutationOptions<Result>,
): Promise<Result | null> {
  if (options.scope === null) {
    return null;
  }

  const activeScope = options.scope;
  const requestId = options.mutationRequestIdRef.current + 1;
  options.mutationRequestIdRef.current = requestId;
  options.setMutationState({
    status: "saving",
    operation: options.operation,
    commentId: options.commentId,
    error: null,
  });

  try {
    const result = await options.run(activeScope);

    if (!isActiveMutation(options, requestId)) {
      return result;
    }

    options.applySuccess?.(result);
    options.setMutationState(initialMutationState);
    return result;
  } catch (error) {
    if (!isActiveMutation(options, requestId)) {
      return null;
    }

    options.applyFailure?.();
    options.setMutationState({
      status: "error",
      operation: options.operation,
      commentId: options.commentId,
      error: normalizeCommandError(error),
    });
    return null;
  }
}

/** @returns Updated comment from a resolve/reopen/toggle command. */
async function runStatusMutation(
  options: RunStatusMutationOptions,
): Promise<Comment | null> {
  return runCommentMutation({
    ...options,
    applySuccess: (comment) => {
      updateCommentsForCurrentScope({
        scope: options.scope,
        statusFilter: options.statusFilter,
        setListState: options.setListState,
        transform: (comments) =>
          upsertDisplayableComment(comments, comment, options.statusFilter),
      });
    },
  });
}

/** @returns True while the mutation still belongs to the latest selected scope. */
function isActiveMutation<Result>(
  options: RunCommentMutationOptions<Result>,
  requestId: number,
): boolean {
  return (
    options.mutationRequestIdRef.current === requestId &&
    options.activeScopeKeyRef.current === options.scopeKey
  );
}

/** Updates comments only when the list currently belongs to the same scope. */
function updateCommentsForCurrentScope(
  options: UpdateCommentsForCurrentScopeOptions,
): void {
  if (options.scope === null) {
    return;
  }

  setCommentsForScope({
    ...options,
    scope: options.scope,
  });
}

/** Applies an immutable comment list transform for a matching scope. */
function setCommentsForScope(
  options: UpdateCommentsForCurrentScopeOptions &
    Readonly<{ scope: CommentScope }>,
): void {
  options.setListState((currentState) => {
    if (
      currentState.scope === null ||
      currentState.scope.workspacePath !== options.scope.workspacePath ||
      currentState.scope.specId !== options.scope.specId ||
      currentState.scope.fileKey !== options.scope.fileKey
    ) {
      return currentState;
    }

    const nextComments = options.transform(currentState.comments);
    return createLoadedListState(
      options.scope,
      options.statusFilter,
      nextComments,
    );
  });
}

/** @returns Comments with a displayable comment appended once. */
function appendDisplayableComment(
  comments: readonly Comment[],
  comment: Comment,
  statusFilter: CommentStatusFilter,
): readonly Comment[] {
  if (!shouldDisplayComment(comment, statusFilter)) {
    return comments;
  }

  if (comments.some((currentComment) => currentComment.id === comment.id)) {
    return comments;
  }

  return [...comments, comment];
}

/** @returns Comments with the given displayable comment inserted or replaced. */
function upsertDisplayableComment(
  comments: readonly Comment[],
  comment: Comment,
  statusFilter: CommentStatusFilter,
): readonly Comment[] {
  const commentWithResolution = preserveAnchorResolution(comments, comment);
  const withoutComment = comments.filter(
    (currentComment) => currentComment.id !== commentWithResolution.id,
  );

  if (!shouldDisplayComment(commentWithResolution, statusFilter)) {
    return withoutComment;
  }

  const replaceIndex = comments.findIndex(
    (currentComment) => currentComment.id === commentWithResolution.id,
  );

  if (replaceIndex < 0) {
    return [...comments, commentWithResolution];
  }

  return comments.map((currentComment) =>
    currentComment.id === commentWithResolution.id
      ? commentWithResolution
      : currentComment,
  );
}

/** @returns A command result with existing resolution metadata retained when omitted. */
function preserveAnchorResolution(
  comments: readonly Comment[],
  comment: Comment,
): Comment {
  if (
    comment.anchorResolution !== undefined &&
    comment.anchorResolution !== null
  ) {
    return comment;
  }

  const currentComment = comments.find(
    (candidate) => candidate.id === comment.id,
  );

  if (
    currentComment === undefined ||
    currentComment.anchorResolution === undefined
  ) {
    return comment;
  }

  return {
    ...comment,
    anchorResolution: currentComment.anchorResolution,
  };
}

/** @returns Comments after toggling one comment locally. */
function upsertOptimisticToggle(
  comments: readonly Comment[],
  commentId: CommentId,
  statusFilter: CommentStatusFilter,
): readonly Comment[] {
  const currentComment = comments.find((comment) => comment.id === commentId);

  if (currentComment === undefined) {
    return comments;
  }

  const nextResolved = !currentComment.resolved;
  const nextComment: Comment = {
    ...currentComment,
    status: nextResolved ? "resolved" : "open",
    resolved: nextResolved,
  };

  return upsertDisplayableComment(comments, nextComment, statusFilter);
}

/** @returns True when the current status filter should include the comment. */
function shouldDisplayComment(
  comment: Comment,
  statusFilter: CommentStatusFilter,
): boolean {
  if (statusFilter === "all") {
    return true;
  }

  return comment.status === statusFilter;
}
