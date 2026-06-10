import {
  type ArchivedUserReview,
  type NonArchivedUserReview,
  UserReview,
  type UserReview as UserReviewType,
} from "@/features/review-runs/domain/userReview";
import type { UserReviewListProblem } from "@/features/review-runs/types/userReviewIpc";

export type UserReviewCollection = Readonly<{
  active: readonly NonArchivedUserReview[];
  archived: readonly ArchivedUserReview[];
  problems: readonly UserReviewListProblem[];
}>;

export type UserReviewCollectionTransform = (
  collection: UserReviewCollection,
) => UserReviewCollection;

export const UserReviewCollection = {
  /** @returns Empty user review collection. */
  empty(): UserReviewCollection {
    return {
      active: [],
      archived: [],
      problems: [],
    };
  },

  /**
   * @param active - Active reviews from the command response.
   * @param archived - Archived reviews from the command response.
   * @param problems - Malformed or missing folder problems.
   * @returns Collection from an already-normalized command response.
   */
  fromListResponse(
    active: readonly UserReviewType[],
    archived: readonly UserReviewType[],
    problems: readonly UserReviewListProblem[],
  ): UserReviewCollection {
    return {
      active: active.map(toNonArchivedReview),
      archived: archived.map(toArchivedReview),
      problems,
    };
  },

  /**
   * @param collection - The current collection.
   * @param userReview - The newly created review to prepend.
   * @returns Collection with the created review first in active results.
   */
  addCreated(
    collection: UserReviewCollection,
    userReview: UserReviewType,
  ): UserReviewCollection {
    const created = toNonArchivedReview(userReview);

    return {
      active: [
        created,
        ...collection.active.filter((review) => review.id !== created.id),
      ],
      archived: collection.archived.filter(
        (review) => review.id !== created.id,
      ),
      problems: collection.problems,
    };
  },

  /**
   * @param collection - The current collection.
   * @param userReview - The archived review to move.
   * @returns Collection with the archived review moved from active to archived.
   */
  moveArchived(
    collection: UserReviewCollection,
    userReview: UserReviewType,
  ): UserReviewCollection {
    const archived = toArchivedReview(userReview);

    return {
      active: collection.active.filter((review) => review.id !== archived.id),
      archived: [
        archived,
        ...collection.archived.filter((review) => review.id !== archived.id),
      ],
      problems: collection.problems,
    };
  },

  /**
   * @param collection - The collection to inspect.
   * @returns True when no active or archived reviews exist.
   */
  isEmpty(collection: UserReviewCollection): boolean {
    return collection.active.length === 0 && collection.archived.length === 0;
  },
} as const;

/**
 * @param userReview - The review expected to be non-archived.
 * @returns Non-archived user review or throws for an invalid active entry.
 * @throws When the review is archived.
 */
function toNonArchivedReview(
  userReview: UserReviewType,
): NonArchivedUserReview {
  if (UserReview.isArchived(userReview)) {
    throw new Error(
      `Archived user review cannot be placed in active collection: ${userReview.id}`,
    );
  }

  return userReview;
}

/**
 * @param userReview - The review expected to be archived.
 * @returns Archived user review or throws for an invalid archived entry.
 * @throws When the review is non-archived.
 */
function toArchivedReview(userReview: UserReviewType): ArchivedUserReview {
  if (UserReview.isNonArchived(userReview)) {
    throw new Error(
      `Non-archived user review cannot be placed in archived collection: ${userReview.id}`,
    );
  }

  return userReview;
}
