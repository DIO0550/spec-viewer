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
  create: (): CommentOperationIdleState => ({
    status: "idle",
    operation: null,
    commentId: null,
    error: null,
  }),

  is: (state: CommentOperationState): state is CommentOperationIdleState =>
    state.status === "idle",
} as const;

export const CommentOperationSavingState = {
  create: (
    operation: CommentOperationKind,
    commentId: CommentId | null,
  ): CommentOperationSavingState => ({
    status: "saving",
    operation,
    commentId,
    error: null,
  }),

  is: (state: CommentOperationState): state is CommentOperationSavingState =>
    state.status === "saving",

  matchesOperation: (
    state: CommentOperationState,
    operation: CommentOperationKind,
  ): boolean =>
    CommentOperationSavingState.is(state) && state.operation === operation,

  isForComment: (
    state: CommentOperationState,
    commentId: Comment["id"],
  ): boolean =>
    CommentOperationSavingState.is(state) && state.commentId === commentId,
} as const;

export const CommentOperationFailedState = {
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

  is: (state: CommentOperationState): state is CommentOperationFailedState =>
    state.status === "error",

  matchesOperation: (
    state: CommentOperationState,
    operation: CommentOperationKind,
  ): boolean =>
    CommentOperationFailedState.is(state) && state.operation === operation,

  errorOf: (state: CommentOperationState): NormalizedCommandError | null =>
    CommentOperationFailedState.is(state) ? state.error : null,

  errorFor: (
    state: CommentOperationState,
    operation: CommentOperationKind,
  ): NormalizedCommandError | null =>
    CommentOperationFailedState.matchesOperation(state, operation)
      ? state.error
      : null,
} as const;
