import {
  UserReviewCollection,
  type UserReviewCollection as UserReviewCollectionType,
  type UserReviewCollectionTransform,
} from "@/features/review-runs/domain/userReviewCollection";
import type { UserReview } from "@/features/review-runs/domain/userReview";
import type { UserReviewTarget } from "@/features/review-runs/domain/userReviewTarget";
import type { UserReviewListProblem } from "@/features/review-runs/types/userReviewIpc";
import type { IpcCommandError } from "@/shared/types/ipc";

export type UserReviewListIdleState = Readonly<{
  status: "idle";
  target: null;
  active: readonly [];
  archived: readonly [];
  problems: readonly [];
  error: null;
}>;

export type UserReviewListLoadingState = Readonly<{
  status: "loading";
  target: UserReviewTarget;
  active: readonly [];
  archived: readonly [];
  problems: readonly [];
  error: null;
}>;

export type UserReviewListReadyState = Readonly<{
  status: "ready";
  target: UserReviewTarget;
  active: readonly UserReview[];
  archived: readonly UserReview[];
  problems: readonly UserReviewListProblem[];
  error: null;
}>;

export type UserReviewListEmptyState = Readonly<{
  status: "empty";
  target: UserReviewTarget;
  active: readonly [];
  archived: readonly [];
  problems: readonly UserReviewListProblem[];
  error: null;
}>;

export type UserReviewListErrorState = Readonly<{
  status: "error";
  target: UserReviewTarget;
  active: readonly [];
  archived: readonly [];
  problems: readonly [];
  error: IpcCommandError;
}>;

export type UserReviewListState =
  | UserReviewListIdleState
  | UserReviewListLoadingState
  | UserReviewListReadyState
  | UserReviewListEmptyState
  | UserReviewListErrorState;

export type UserReviewListTransformResult = Readonly<{
  state: UserReviewListState;
  invalidatesRequest: boolean;
}>;

export type UserReviewListEvent =
  | Readonly<{
      type: "reviewCreated";
      review: UserReview;
    }>
  | Readonly<{
      type: "reviewArchived";
      review: UserReview;
    }>;

export type UserReviewListEventResult = Readonly<{
  state: UserReviewListState;
  invalidatesInFlightListRequest: boolean;
}>;

export const UserReviewListState = {
  /** @returns Idle list state with no active target. */
  idle(): UserReviewListIdleState {
    return {
      status: "idle",
      target: null,
      active: [],
      archived: [],
      problems: [],
      error: null,
    };
  },

  /** @returns Loading list state for the active target. */
  loading(target: UserReviewTarget): UserReviewListLoadingState {
    return {
      status: "loading",
      target,
      active: [],
      archived: [],
      problems: [],
      error: null,
    };
  },

  /** @returns Ready or empty list state for a normalized collection. */
  loaded(
    target: UserReviewTarget,
    collection: UserReviewCollectionType,
  ): UserReviewListReadyState | UserReviewListEmptyState {
    if (UserReviewCollection.isEmpty(collection)) {
      return {
        status: "empty",
        target,
        active: [],
        archived: [],
        problems: collection.problems,
        error: null,
      };
    }

    return {
      status: "ready",
      target,
      active: collection.active,
      archived: collection.archived,
      problems: collection.problems,
      error: null,
    };
  },

  /** @returns Error list state for a failed target load. */
  error(
    target: UserReviewTarget,
    error: IpcCommandError,
  ): UserReviewListErrorState {
    return {
      status: "error",
      target,
      active: [],
      archived: [],
      problems: [],
      error,
    };
  },

  /** @returns True when the list has active or empty loaded data. */
  isLoaded(
    state: UserReviewListState,
  ): state is UserReviewListReadyState | UserReviewListEmptyState {
    return state.status === "ready" || state.status === "empty";
  },

  /** @returns State transformed by a user review event plus request invalidation. */
  reduceUserReviewEvent(
    state: UserReviewListState,
    event: UserReviewListEvent,
  ): UserReviewListEventResult {
    const result = applyCollectionTransformForState(state, (collection) => {
      if (event.type === "reviewCreated") {
        return UserReviewCollection.addCreated(collection, event.review);
      }

      return UserReviewCollection.moveArchived(collection, event.review);
    });

    return {
      state: result.state,
      invalidatesInFlightListRequest: result.invalidatesRequest,
    };
  },

  /** @returns State transformed by a collection update plus request invalidation. */
  applyCollectionTransform(
    state: UserReviewListState,
    transform: UserReviewCollectionTransform,
  ): UserReviewListTransformResult {
    return applyCollectionTransformForState(state, transform);
  },
} as const;

/** @returns State transformed by a collection update plus request invalidation. */
function applyCollectionTransformForState(
  state: UserReviewListState,
  transform: UserReviewCollectionTransform,
): UserReviewListTransformResult {
  if (state.status === "idle") {
    return {
      state,
      invalidatesRequest: false,
    };
  }

  const collection = collectionFromState(state);
  const nextCollection = transform(collection);

  return {
    state: UserReviewListState.loaded(state.target, nextCollection),
    invalidatesRequest:
      state.status === "loading" && nextCollection !== collection,
  };
}

/** @returns Domain collection represented by a list state. */
function collectionFromState(
  state: Exclude<UserReviewListState, UserReviewListIdleState>,
): UserReviewCollectionType {
  if (UserReviewListState.isLoaded(state)) {
    return UserReviewCollection.fromListResponse(
      state.active,
      state.archived,
      state.problems,
    );
  }

  return UserReviewCollection.empty();
}
