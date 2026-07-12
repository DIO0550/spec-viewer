import type { Comment, CommentId } from "@/features/comments/types/comment";

export type CommentOperationKind =
  | "add"
  | "update"
  | "delete"
  | "resolve"
  | "reopen"
  | "toggle";

export type CommentOperationIdleState = Readonly<{
  status: "idle";
  operation: null;
  commentId: null;
  error: null;
}>;

export type CommentOperationSavingState = Readonly<{
  status: "saving";
  operation: CommentOperationKind;
  commentId: CommentId | null;
  error: null;
}>;

export type CommentOperationFailedState<TError = unknown> = Readonly<{
  status: "error";
  operation: CommentOperationKind;
  commentId: CommentId | null;
  error: TError;
}>;

export type CommentOperationState<TError = unknown> =
  | CommentOperationIdleState
  | CommentOperationSavingState
  | CommentOperationFailedState<TError>;

export const CommentOperationIdleState = {
  /**
   * @returns A fresh idle comment operation state.
   */
  create: (): CommentOperationIdleState => ({
    status: "idle",
    operation: null,
    commentId: null,
    error: null,
  }),

  /**
   * @param state - The comment operation state to test.
   * @returns True when the state is idle.
   */
  is: (
    state: CommentOperationState<unknown>,
  ): state is CommentOperationIdleState => state.status === "idle",
} as const;

export const CommentOperationSavingState = {
  /**
   * @param operation - The operation kind being saved.
   * @param commentId - The target comment id, or null when not comment-scoped.
   * @returns A saving comment operation state.
   */
  create: (
    operation: CommentOperationKind,
    commentId: CommentId | null,
  ): CommentOperationSavingState => ({
    status: "saving",
    operation,
    commentId,
    error: null,
  }),

  /**
   * @param state - The comment operation state to test.
   * @returns True when the state is saving.
   */
  is: (
    state: CommentOperationState<unknown>,
  ): state is CommentOperationSavingState => state.status === "saving",

  /**
   * @param state - The comment operation state to test.
   * @param operation - The operation kind to match against.
   * @returns True when the state is saving the given operation.
   */
  matchesOperation: (
    state: CommentOperationState<unknown>,
    operation: CommentOperationKind,
  ): boolean =>
    CommentOperationSavingState.is(state) && state.operation === operation,

  /**
   * @param state - The comment operation state to test.
   * @param commentId - The comment id to match against.
   * @returns True when the state is saving for the given comment.
   */
  isForComment: (
    state: CommentOperationState<unknown>,
    commentId: Comment["id"],
  ): boolean =>
    CommentOperationSavingState.is(state) && state.commentId === commentId,
} as const;

export const CommentOperationFailedState = {
  /**
   * @param operation - The operation kind that failed.
   * @param commentId - The target comment id, or null when not comment-scoped.
   * @param error - The feature error describing the failure.
   * @returns A failed comment operation state.
   */
  create: <TError>(
    operation: CommentOperationKind,
    commentId: CommentId | null,
    error: TError,
  ): CommentOperationFailedState<TError> => ({
    status: "error",
    operation,
    commentId,
    error,
  }),

  /**
   * @param state - The comment operation state to test.
   * @returns True when the state is a failure.
   */
  is: <TError>(
    state: CommentOperationState<TError>,
  ): state is CommentOperationFailedState<TError> => state.status === "error",

  /**
   * @param state - The comment operation state to test.
   * @param operation - The operation kind to match against.
   * @returns True when the state failed for the given operation.
   */
  matchesOperation: (
    state: CommentOperationState<unknown>,
    operation: CommentOperationKind,
  ): boolean =>
    CommentOperationFailedState.is(state) && state.operation === operation,

  /**
   * @param state - The comment operation state to inspect.
   * @returns The failure error, or null when the state is not a failure.
   */
  errorOf: <TError>(state: CommentOperationState<TError>): TError | null =>
    CommentOperationFailedState.is(state) ? state.error : null,

  /**
   * @param state - The comment operation state to inspect.
   * @param operation - The operation kind to match against.
   * @returns The failure error for the given operation, or null otherwise.
   */
  errorFor: <TError>(
    state: CommentOperationState<TError>,
    operation: CommentOperationKind,
  ): TError | null =>
    CommentOperationFailedState.matchesOperation(state, operation)
      ? state.error
      : null,
} as const;
