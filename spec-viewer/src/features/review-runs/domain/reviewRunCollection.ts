import {
  ReviewRunEntity,
  type ArchivedReviewRun,
  type NonArchivedReviewRun,
} from "@/features/review-runs/domain/reviewRun";
import type {
  ReviewRun,
  ReviewRunListProblem,
} from "@/features/review-runs/types/reviewRun";

export type ReviewRunCollection = Readonly<{
  active: readonly NonArchivedReviewRun[];
  archived: readonly ArchivedReviewRun[];
  problems: readonly ReviewRunListProblem[];
}>;

export type ReviewRunCollectionTransform = (
  collection: ReviewRunCollection,
) => ReviewRunCollection;

export const ReviewRunCollection = {
  /** @returns Empty review-run collection. */
  empty(): ReviewRunCollection {
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
  ): ReviewRunCollection {
    return {
      active: active.map(toNonArchivedRun),
      archived: archived.map(toArchivedRun),
      problems,
    };
  },

  /** @returns Collection with the created run first in active results. */
  addCreated(
    collection: ReviewRunCollection,
    reviewRun: ReviewRun,
  ): ReviewRunCollection {
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

  /** @returns Collection with the archived run moved from active to archived. */
  moveArchived(
    collection: ReviewRunCollection,
    reviewRun: ReviewRun,
  ): ReviewRunCollection {
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
  isEmpty(collection: ReviewRunCollection): boolean {
    return collection.active.length === 0 && collection.archived.length === 0;
  },
} as const;

/** @returns Non-archived review run or throws for an invalid active entry. */
function toNonArchivedRun(reviewRun: ReviewRun): NonArchivedReviewRun {
  const entity = ReviewRunEntity.fromDto(reviewRun);

  if (ReviewRunEntity.isArchived(entity)) {
    throw new Error(
      `Archived review run cannot be placed in active collection: ${reviewRun.id}`,
    );
  }

  return entity;
}

/** @returns Archived review run or throws for an invalid archived entry. */
function toArchivedRun(reviewRun: ReviewRun): ArchivedReviewRun {
  const entity = ReviewRunEntity.fromDto(reviewRun);

  if (ReviewRunEntity.isNonArchived(entity)) {
    throw new Error(
      `Non-archived review run cannot be placed in archived collection: ${reviewRun.id}`,
    );
  }

  return entity;
}
