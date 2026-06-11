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

export type CommentOperationEvent =
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

export const CommentOperationEvent = {
  /**
   * @param _state - Current operation state.
   * @param event - Operation lifecycle event.
   * @returns Next operation state.
   */
  reduce(
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
        return CommentOperationIdleState.create();
      case "operationFailed":
        return CommentOperationFailedState.create(
          event.operation,
          event.commentId,
          event.error,
        );
      default:
        return assertNever(event);
    }
  },
} as const;

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

export const CommentOperationIdleState = {
  /** @returns The idle comment operation state. */
  create: (): CommentOperationIdleState => ({
    status: "idle",
    operation: null,
    commentId: null,
    error: null,
  }),

  /**
   * @param state - Current operation state
   * @returns True when no operation is running or failed.
   */
  is: (state: CommentOperationState): state is CommentOperationIdleState =>
    state.status === "idle",
} as const;

export const CommentOperationSavingState = {
  /**
   * @param operation - Operation kind being saved
   * @param commentId - Target comment, or null for additions
   * @returns The saving comment operation state.
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
   * @param state - Current operation state
   * @returns True when an operation is being saved.
   */
  is: (state: CommentOperationState): state is CommentOperationSavingState =>
    state.status === "saving",

  /**
   * @param state - Current operation state
   * @param operation - Operation kind to match
   * @returns True when the given operation kind is being saved.
   */
  matchesOperation: (
    state: CommentOperationState,
    operation: CommentOperationKind,
  ): boolean =>
    CommentOperationSavingState.is(state) && state.operation === operation,

  /**
   * @param state - Current operation state
   * @param commentId - Comment to match
   * @returns True when the given comment is being saved.
   */
  isForComment: (
    state: CommentOperationState,
    commentId: Comment["id"],
  ): boolean =>
    CommentOperationSavingState.is(state) && state.commentId === commentId,
} as const;

export const CommentOperationFailedState = {
  /**
   * @param operation - Operation kind that failed
   * @param commentId - Target comment, or null for additions
   * @param error - Normalized command failure
   * @returns The failed comment operation state.
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
   * @param state - Current operation state
   * @returns True when the last operation failed.
   */
  is: (state: CommentOperationState): state is CommentOperationFailedState =>
    state.status === "error",

  /**
   * @param state - Current operation state
   * @param operation - Operation kind to match
   * @returns True when the given operation kind failed.
   */
  matchesOperation: (
    state: CommentOperationState,
    operation: CommentOperationKind,
  ): boolean =>
    CommentOperationFailedState.is(state) && state.operation === operation,

  /**
   * @param state - Current operation state
   * @returns The failure for the last operation, or null.
   */
  errorOf: (state: CommentOperationState): NormalizedCommandError | null =>
    CommentOperationFailedState.is(state) ? state.error : null,

  /**
   * @param state - Current operation state
   * @param operation - Operation kind to match
   * @returns The failure for the given operation kind, or null.
   */
  errorFor: (
    state: CommentOperationState,
    operation: CommentOperationKind,
  ): NormalizedCommandError | null =>
    CommentOperationFailedState.matchesOperation(state, operation)
      ? state.error
      : null,
} as const;
