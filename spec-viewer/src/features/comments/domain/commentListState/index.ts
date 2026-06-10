import type { Comment } from "@/features/comments/types/comment";
import type { NormalizedCommandError } from "@/shared/types/ipc";

export type CommentListIdleState = Readonly<{
  status: "idle";
  comments: readonly [];
  error: null;
}>;

export type CommentListLoadingState = Readonly<{
  status: "loading";
  comments: readonly [];
  error: null;
}>;

export type CommentListReadyState = Readonly<{
  status: "ready";
  comments: readonly Comment[];
  error: null;
}>;

export type CommentListEmptyState = Readonly<{
  status: "empty";
  comments: readonly [];
  error: null;
}>;

export type CommentListErrorState = Readonly<{
  status: "error";
  comments: readonly [];
  error: NormalizedCommandError;
}>;

export type CommentListState =
  | CommentListIdleState
  | CommentListLoadingState
  | CommentListReadyState
  | CommentListEmptyState
  | CommentListErrorState;

export type CommentListTransform = (
  comments: readonly Comment[],
) => readonly Comment[];

export type CommentListTransformResult = Readonly<{
  state: CommentListState;
  invalidatesRequest: boolean;
}>;

export const CommentListState = {
  /** @returns The initial state before any comments are requested. */
  idle: (): CommentListIdleState => ({
    status: "idle",
    comments: [],
    error: null,
  }),

  /** @returns The state while comments are being fetched. */
  loading: (): CommentListLoadingState => ({
    status: "loading",
    comments: [],
    error: null,
  }),

  /**
   * @param comments - The fetched comments
   * @returns An empty state when there are no comments, otherwise a ready state.
   */
  loaded: (
    comments: readonly Comment[],
  ): CommentListReadyState | CommentListEmptyState => {
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
  },

  /**
   * @param error - The normalized command error
   * @returns An error state carrying the failure.
   */
  error: (error: NormalizedCommandError): CommentListErrorState => ({
    status: "error",
    comments: [],
    error,
  }),

  /**
   * @param state - The state to inspect
   * @returns True when the state is idle.
   */
  isIdle: (state: CommentListState): state is CommentListIdleState =>
    state.status === "idle",

  /**
   * @param state - The state to inspect
   * @returns True when the state is loading.
   */
  isLoading: (state: CommentListState): state is CommentListLoadingState =>
    state.status === "loading",

  /**
   * @param state - The state to inspect
   * @returns True when the state is ready or empty.
   */
  isLoaded: (
    state: CommentListState,
  ): state is CommentListReadyState | CommentListEmptyState =>
    state.status === "ready" || state.status === "empty",

  /**
   * @param state - The current state
   * @param transform - The comment transform to apply
   * @returns The next state and whether an in-flight request is invalidated.
   */
  applyTransform: (
    state: CommentListState,
    transform: CommentListTransform,
  ): CommentListTransformResult => {
    if (CommentListState.isIdle(state)) {
      return {
        state,
        invalidatesRequest: false,
      };
    }

    const nextComments = transform(state.comments);

    return {
      state: CommentListState.loaded(nextComments),
      invalidatesRequest:
        CommentListState.isLoading(state) && nextComments !== state.comments,
    };
  },
} as const;
