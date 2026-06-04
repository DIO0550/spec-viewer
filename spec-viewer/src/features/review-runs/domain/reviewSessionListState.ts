import {
  ReviewSessionCollection,
  type ReviewSessionCollection as ReviewSessionCollectionType,
  type ReviewSessionCollectionTransform,
} from "@/features/review-runs/domain/reviewSessionCollection";
import type {
  ReviewRun,
  ReviewRunListProblem,
  ReviewRunTarget,
} from "@/features/review-runs/types/reviewRun";
import type { NormalizedCommandError } from "@/shared/types/ipc";

export type ReviewSessionListIdleState = Readonly<{
  status: "idle";
  target: null;
  active: readonly [];
  archived: readonly [];
  problems: readonly [];
  error: null;
}>;

export type ReviewSessionListLoadingState = Readonly<{
  status: "loading";
  target: ReviewRunTarget;
  active: readonly [];
  archived: readonly [];
  problems: readonly [];
  error: null;
}>;

export type ReviewSessionListReadyState = Readonly<{
  status: "ready";
  target: ReviewRunTarget;
  active: readonly ReviewRun[];
  archived: readonly ReviewRun[];
  problems: readonly ReviewRunListProblem[];
  error: null;
}>;

export type ReviewSessionListEmptyState = Readonly<{
  status: "empty";
  target: ReviewRunTarget;
  active: readonly [];
  archived: readonly [];
  problems: readonly ReviewRunListProblem[];
  error: null;
}>;

export type ReviewSessionListErrorState = Readonly<{
  status: "error";
  target: ReviewRunTarget;
  active: readonly [];
  archived: readonly [];
  problems: readonly [];
  error: NormalizedCommandError;
}>;

export type ReviewSessionListState =
  | ReviewSessionListIdleState
  | ReviewSessionListLoadingState
  | ReviewSessionListReadyState
  | ReviewSessionListEmptyState
  | ReviewSessionListErrorState;

export type ReviewSessionListTransformResult = Readonly<{
  state: ReviewSessionListState;
  invalidatesRequest: boolean;
}>;

export const ReviewSessionListState = {
  /** @returns Idle list state with no active target. */
  idle(): ReviewSessionListIdleState {
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
  loading(target: ReviewRunTarget): ReviewSessionListLoadingState {
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
    collection: ReviewSessionCollectionType,
  ): ReviewSessionListReadyState | ReviewSessionListEmptyState {
    if (ReviewSessionCollection.isEmpty(collection)) {
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
  ): ReviewSessionListErrorState {
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
    state: ReviewSessionListState,
  ): state is ReviewSessionListReadyState | ReviewSessionListEmptyState {
    return state.status === "ready" || state.status === "empty";
  },

  /** @returns State transformed by a collection update plus request invalidation. */
  applyCollectionTransform(
    state: ReviewSessionListState,
    transform: ReviewSessionCollectionTransform,
  ): ReviewSessionListTransformResult {
    if (state.status === "idle") {
      return {
        state,
        invalidatesRequest: false,
      };
    }

    const collection = collectionFromState(state);
    const nextCollection = transform(collection);

    return {
      state: ReviewSessionListState.loaded(state.target, nextCollection),
      invalidatesRequest:
        state.status === "loading" && nextCollection !== collection,
    };
  },
} as const;

/** @returns Domain collection represented by a list state. */
function collectionFromState(
  state: Exclude<ReviewSessionListState, ReviewSessionListIdleState>,
): ReviewSessionCollectionType {
  if (ReviewSessionListState.isLoaded(state)) {
    return ReviewSessionCollection.fromListResponse(
      state.active,
      state.archived,
      state.problems,
    );
  }

  return ReviewSessionCollection.empty();
}
