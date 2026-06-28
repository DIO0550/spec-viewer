import type { Comment } from "@/features/comments/types/comment";
import type { IpcCommandError } from "@/shared/types/ipc";

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
  error: IpcCommandError;
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
  idle: (): CommentListIdleState => ({
    status: "idle",
    comments: [],
    error: null,
  }),

  loading: (): CommentListLoadingState => ({
    status: "loading",
    comments: [],
    error: null,
  }),

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

  error: (error: IpcCommandError): CommentListErrorState => ({
    status: "error",
    comments: [],
    error,
  }),

  isIdle: (state: CommentListState): state is CommentListIdleState =>
    state.status === "idle",

  isLoading: (state: CommentListState): state is CommentListLoadingState =>
    state.status === "loading",

  isLoaded: (
    state: CommentListState,
  ): state is CommentListReadyState | CommentListEmptyState =>
    state.status === "ready" || state.status === "empty",

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
