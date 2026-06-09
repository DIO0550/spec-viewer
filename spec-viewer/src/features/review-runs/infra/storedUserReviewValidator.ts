import {
  UserReviewStatus,
  type StoredUserReview,
  type UserReview,
  type UserReviewArchiveStateError,
} from "@/features/review-runs/domain/userReview";

export const StoredUserReviewValidator = {
  /** @returns User review validated from stored user review data. */
  validate(storedUserReview: StoredUserReview): UserReview {
    const result = StoredUserReviewValidator.tryValidate(storedUserReview);

    if (!result.ok) {
      throw new Error(result.error.message);
    }

    return result.userReview;
  },

  /** @returns Restore result without throwing for archive state inconsistencies. */
  tryValidate(
    storedUserReview: StoredUserReview,
  ):
    | Readonly<{
        ok: true;
        userReview: UserReview;
      }>
    | Readonly<{
        ok: false;
        error: UserReviewArchiveStateError;
      }> {
    const error = validateArchiveState(storedUserReview);

    if (error !== null) {
      return {
        ok: false,
        error,
      };
    }

    return {
      ok: true,
      userReview: storedUserReview as UserReview,
    };
  },
} as const;

/** @returns Archive state error, or null when status and archivedAt are consistent. */
function validateArchiveState(
  storedUserReview: StoredUserReview,
): UserReviewArchiveStateError | null {
  if (
    UserReviewStatus.isArchived(storedUserReview.status) &&
    storedUserReview.archivedAt === null
  ) {
    return {
      reason: "archivedMissingArchivedAt",
      id: storedUserReview.id,
      message: `Archived user review must have archivedAt: ${storedUserReview.id}`,
    };
  }

  if (
    UserReviewStatus.isNonArchived(storedUserReview.status) &&
    storedUserReview.archivedAt !== null
  ) {
    return {
      reason: "nonArchivedHasArchivedAt",
      id: storedUserReview.id,
      message: `Non-archived user review must not have archivedAt: ${storedUserReview.id}`,
    };
  }

  return null;
}
