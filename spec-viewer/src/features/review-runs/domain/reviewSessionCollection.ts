import {
  ReviewSession,
  type ArchivedReviewSession,
  type NonArchivedReviewSession,
} from "@/features/review-runs/domain/reviewSession";
import type {
  ReviewRun,
  ReviewRunListProblem,
} from "@/features/review-runs/types/reviewRun";

export type ReviewSessionCollection = Readonly<{
  active: readonly NonArchivedReviewSession[];
  archived: readonly ArchivedReviewSession[];
  problems: readonly ReviewRunListProblem[];
}>;

export type ReviewSessionCollectionTransform = (
  collection: ReviewSessionCollection,
) => ReviewSessionCollection;

export const ReviewSessionCollection = {
  /** @returns Empty review-session collection. */
  empty(): ReviewSessionCollection {
    return {
      active: [],
      archived: [],
      problems: [],
    };
  },

  /** @returns Collection normalized from a list command response. */
  fromListResponse(
    active: readonly ReviewRun[],
    archived: readonly ReviewRun[],
    problems: readonly ReviewRunListProblem[],
  ): ReviewSessionCollection {
    return {
      active: active.map(toNonArchivedRun),
      archived: archived.map(toArchivedRun),
      problems,
    };
  },

  /** @returns Collection with the created session first in active results. */
  addCreated(
    collection: ReviewSessionCollection,
    reviewRun: ReviewRun,
  ): ReviewSessionCollection {
    const created = toNonArchivedRun(reviewRun);

    return {
      active: [
        created,
        ...collection.active.filter((run) => run.id !== created.id),
      ],
      archived: collection.archived.filter((run) => run.id !== created.id),
      problems: collection.problems,
    };
  },

  /** @returns Collection with the archived session moved from active to archived. */
  moveArchived(
    collection: ReviewSessionCollection,
    reviewRun: ReviewRun,
  ): ReviewSessionCollection {
    const archived = toArchivedRun(reviewRun);

    return {
      active: collection.active.filter((run) => run.id !== archived.id),
      archived: [
        archived,
        ...collection.archived.filter((run) => run.id !== archived.id),
      ],
      problems: collection.problems,
    };
  },

  /** @returns True when no active or archived runs exist. */
  isEmpty(collection: ReviewSessionCollection): boolean {
    return collection.active.length === 0 && collection.archived.length === 0;
  },
} as const;

/** @returns Non-archived review run or throws for an invalid active entry. */
function toNonArchivedRun(reviewRun: ReviewRun): NonArchivedReviewSession {
  const entity = ReviewSession.fromDto(reviewRun);

  if (ReviewSession.isArchived(entity)) {
    throw new Error(
      `Archived review run cannot be placed in active collection: ${reviewRun.id}`,
    );
  }

  return entity;
}

/** @returns Archived review run or throws for an invalid archived entry. */
function toArchivedRun(reviewRun: ReviewRun): ArchivedReviewSession {
  const entity = ReviewSession.fromDto(reviewRun);

  if (ReviewSession.isNonArchived(entity)) {
    throw new Error(
      `Non-archived review run cannot be placed in archived collection: ${reviewRun.id}`,
    );
  }

  return entity;
}
