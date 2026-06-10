import type { Comment, CommentId } from "@/features/comments/types/comment";
import type { NormalizedCommandError } from "@/shared/types/ipc";

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

export type CommentOperationFailedState = Readonly<{
  status: "error";
  operation: CommentOperationKind;
  commentId: CommentId | null;
  error: NormalizedCommandError;
}>;

export type CommentOperationState =
  | CommentOperationIdleState
  | CommentOperationSavingState
  | CommentOperationFailedState;

export const CommentOperationIdleState = {
  /** @returns An idle operation state with no pending operation. */
  create: (): CommentOperationIdleState => ({
    status: "idle",
    operation: null,
    commentId: null,
    error: null,
  }),

  /**
   * @param state - The operation state to inspect
   * @returns True when the state is idle.
   */
  is: (state: CommentOperationState): state is CommentOperationIdleState =>
    state.status === "idle",
} as const;

export const CommentOperationSavingState = {
  /**
   * @param operation - The kind of operation in progress
   * @param commentId - The target comment id, or null when not yet created
   * @returns A saving operation state.
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
   * @param state - The operation state to inspect
   * @returns True when the state is saving.
   */
  is: (state: CommentOperationState): state is CommentOperationSavingState =>
    state.status === "saving",

  /**
   * @param state - The operation state to inspect
   * @param operation - The operation kind to match
   * @returns True when the state is saving the given operation.
   */
  matchesOperation: (
    state: CommentOperationState,
    operation: CommentOperationKind,
  ): boolean =>
    CommentOperationSavingState.is(state) && state.operation === operation,

  /**
   * @param state - The operation state to inspect
   * @param commentId - The comment id to match
   * @returns True when the state is saving for the given comment.
   */
  isForComment: (
    state: CommentOperationState,
    commentId: Comment["id"],
  ): boolean =>
    CommentOperationSavingState.is(state) && state.commentId === commentId,
} as const;

export const CommentOperationFailedState = {
  /**
   * @param operation - The kind of operation that failed
   * @param commentId - The target comment id, or null when not yet created
   * @param error - The normalized command error
   * @returns A failed operation state carrying the error.
   */
  create: (
    operation: CommentOperationKind,
    commentId: CommentId | null,
    error: NormalizedCommandError,
  ): CommentOperationFailedState => ({
    status: "error",
    operation,
    commentId,
    error,
  }),

  /**
   * @param state - The operation state to inspect
   * @returns True when the state is failed.
   */
  is: (state: CommentOperationState): state is CommentOperationFailedState =>
    state.status === "error",

  /**
   * @param state - The operation state to inspect
   * @param operation - The operation kind to match
   * @returns True when the state failed for the given operation.
   */
  matchesOperation: (
    state: CommentOperationState,
    operation: CommentOperationKind,
  ): boolean =>
    CommentOperationFailedState.is(state) && state.operation === operation,

  /**
   * @param state - The operation state to inspect
   * @returns The error when the state is failed, otherwise null.
   */
  errorOf: (state: CommentOperationState): NormalizedCommandError | null =>
    CommentOperationFailedState.is(state) ? state.error : null,

  /**
   * @param state - The operation state to inspect
   * @param operation - The operation kind to match
   * @returns The error when the state failed for the given operation, otherwise null.
   */
  errorFor: (
    state: CommentOperationState,
    operation: CommentOperationKind,
  ): NormalizedCommandError | null =>
    CommentOperationFailedState.matchesOperation(state, operation)
      ? state.error
      : null,
} as const;
