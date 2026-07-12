import type { Comment } from "@/features/comments/types/comment";

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

export type CommentListErrorState<TError = unknown> = Readonly<{
  status: "error";
  comments: readonly [];
  error: TError;
}>;

export type CommentListState<TError = unknown> =
  | CommentListIdleState
  | CommentListLoadingState
  | CommentListReadyState
  | CommentListEmptyState
  | CommentListErrorState<TError>;

export type CommentListTransform = (
  comments: readonly Comment[],
) => readonly Comment[];

export type CommentListTransformResult<TError = unknown> = Readonly<{
  state: CommentListState<TError>;
  invalidatesRequest: boolean;
}>;

export const CommentListState = {
  /**
   * @returns A fresh idle comment list state.
   */
  idle: (): CommentListIdleState => ({
    status: "idle",
    comments: [],
    error: null,
  }),

  /**
   * @returns A loading comment list state.
   */
  loading: (): CommentListLoadingState => ({
    status: "loading",
    comments: [],
    error: null,
  }),

  /**
   * @param comments - The loaded comments.
   * @returns A ready state, or an empty state when there are no comments.
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
   * @param error - The feature error to wrap.
   * @returns An error comment list state.
   */
  error: <TError>(error: TError): CommentListErrorState<TError> => ({
    status: "error",
    comments: [],
    error,
  }),

  /**
   * @param state - The comment list state to test.
   * @returns True when the state is idle.
   */
  isIdle: (state: CommentListState<unknown>): state is CommentListIdleState =>
    state.status === "idle",

  /**
   * @param state - The comment list state to test.
   * @returns True when the state is loading.
   */
  isLoading: (
    state: CommentListState<unknown>,
  ): state is CommentListLoadingState => state.status === "loading",

  /**
   * @param state - The comment list state to test.
   * @returns True when the state is ready or empty.
   */
  isLoaded: (
    state: CommentListState<unknown>,
  ): state is CommentListReadyState | CommentListEmptyState =>
    state.status === "ready" || state.status === "empty",

  /**
   * @param state - The current comment list state.
   * @param transform - The transform applied to the comment list.
   * @returns The next state and whether it invalidates the in-flight request.
   */
  applyTransform: <TError>(
    state: CommentListState<TError>,
    transform: CommentListTransform,
  ): CommentListTransformResult<TError> => {
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
