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
  /** @returns The idle list state. */
  idle: (): CommentListIdleState => ({
    status: "idle",
    comments: [],
    error: null,
  }),

  /** @returns The loading list state. */
  loading: (): CommentListLoadingState => ({
    status: "loading",
    comments: [],
    error: null,
  }),

  /**
   * @param comments - Loaded comments.
   * @returns The ready state, or the empty state when no comments exist.
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
   * @param error - Normalized command error that failed the load.
   * @returns The error list state.
   */
  error: (error: NormalizedCommandError): CommentListErrorState => ({
    status: "error",
    comments: [],
    error,
  }),

  /**
   * @param state - List state to test.
   * @returns true when the state is idle.
   */
  isIdle: (state: CommentListState): state is CommentListIdleState =>
    state.status === "idle",

  /**
   * @param state - List state to test.
   * @returns true when the state is loading.
   */
  isLoading: (state: CommentListState): state is CommentListLoadingState =>
    state.status === "loading",

  /**
   * @param state - List state to test.
   * @returns true when the state is ready or empty.
   */
  isLoaded: (
    state: CommentListState,
  ): state is CommentListReadyState | CommentListEmptyState =>
    state.status === "ready" || state.status === "empty",

  /**
   * @param state - Current list state.
   * @param transform - Transform applied to the current comments.
   * @returns The transformed state and whether an in-flight request is invalidated.
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
