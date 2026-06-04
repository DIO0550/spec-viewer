import {
  ReviewRunCollection,
  type ReviewRunCollection as ReviewRunCollectionType,
  type ReviewRunCollectionTransform,
} from "@/features/review-runs/domain/reviewRunCollection";
import type {
  ReviewRun,
  ReviewRunListProblem,
  ReviewRunTarget,
} from "@/features/review-runs/types/reviewRun";
import type { NormalizedCommandError } from "@/shared/types/ipc";

export type ReviewRunListIdleState = Readonly<{
  status: "idle";
  target: null;
  active: readonly [];
  archived: readonly [];
  problems: readonly [];
  error: null;
}>;

export type ReviewRunListLoadingState = Readonly<{
  status: "loading";
  target: ReviewRunTarget;
  active: readonly [];
  archived: readonly [];
  problems: readonly [];
  error: null;
}>;

export type ReviewRunListReadyState = Readonly<{
  status: "ready";
  target: ReviewRunTarget;
  active: readonly ReviewRun[];
  archived: readonly ReviewRun[];
  problems: readonly ReviewRunListProblem[];
  error: null;
}>;

export type ReviewRunListEmptyState = Readonly<{
  status: "empty";
  target: ReviewRunTarget;
  active: readonly [];
  archived: readonly [];
  problems: readonly ReviewRunListProblem[];
  error: null;
}>;

export type ReviewRunListErrorState = Readonly<{
  status: "error";
  target: ReviewRunTarget;
  active: readonly [];
  archived: readonly [];
  problems: readonly [];
  error: NormalizedCommandError;
}>;

export type ReviewRunListState =
  | ReviewRunListIdleState
  | ReviewRunListLoadingState
  | ReviewRunListReadyState
  | ReviewRunListEmptyState
  | ReviewRunListErrorState;

export type ReviewRunListTransformResult = Readonly<{
  state: ReviewRunListState;
  invalidatesRequest: boolean;
}>;

export const ReviewRunListState = {
  /** @returns Idle list state with no active target. */
  idle(): ReviewRunListIdleState {
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
  loading(target: ReviewRunTarget): ReviewRunListLoadingState {
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
    target: ReviewRunTarget,
    collection: ReviewRunCollectionType,
  ): ReviewRunListReadyState | ReviewRunListEmptyState {
    if (ReviewRunCollection.isEmpty(collection)) {
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
    target: ReviewRunTarget,
    error: NormalizedCommandError,
  ): ReviewRunListErrorState {
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
    state: ReviewRunListState,
  ): state is ReviewRunListReadyState | ReviewRunListEmptyState {
    return state.status === "ready" || state.status === "empty";
  },

  /** @returns State transformed by a collection update plus request invalidation. */
  applyCollectionTransform(
    state: ReviewRunListState,
    transform: ReviewRunCollectionTransform,
  ): ReviewRunListTransformResult {
    if (state.status === "idle") {
      return {
        state,
        invalidatesRequest: false,
      };
    }

    const collection = collectionFromState(state);
    const nextCollection = transform(collection);

    return {
      state: ReviewRunListState.loaded(state.target, nextCollection),
      invalidatesRequest:
        state.status === "loading" && nextCollection !== collection,
    };
  },
} as const;

/** @returns Domain collection represented by a list state. */
function collectionFromState(
  state: Exclude<ReviewRunListState, ReviewRunListIdleState>,
): ReviewRunCollectionType {
  if (ReviewRunListState.isLoaded(state)) {
    return ReviewRunCollection.fromListResponse(
      state.active,
      state.archived,
      state.problems,
    );
  }

  return ReviewRunCollection.empty();
}
