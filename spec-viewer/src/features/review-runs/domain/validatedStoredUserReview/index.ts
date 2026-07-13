import {
  UserReviewStatus,
  type StoredUserReview,
  type UserReview,
  type UserReviewArchiveStateError,
} from "@/features/review-runs/domain/userReview";

export type ValidatedStoredUserReview = UserReview;

export const ValidatedStoredUserReview = {
  /**
   * @param storedUserReview - Stored user review data read from a boundary.
   * @returns Validation result for converting stored data into validated stored data.
   */
  from(storedUserReview: StoredUserReview):
    | Readonly<{
        ok: true;
        validatedStoredUserReview: ValidatedStoredUserReview;
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
      validatedStoredUserReview: restoreValidatedUserReview(storedUserReview),
    };
  },

  /**
   * @param validatedStoredUserReview - Stored user review after validation.
   * @returns Domain user review represented by validated stored data.
   */
  to(validatedStoredUserReview: ValidatedStoredUserReview): UserReview {
    return validatedStoredUserReview;
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

/** @returns A discriminated review after archive-state validation. */
function restoreValidatedUserReview(
  storedUserReview: StoredUserReview,
): ValidatedStoredUserReview {
  if (
    storedUserReview.status === "archived" &&
    storedUserReview.archivedAt !== null
  ) {
    return {
      ...storedUserReview,
      status: "archived",
      archivedAt: storedUserReview.archivedAt,
    };
  }

  if (storedUserReview.status === "inProgress") {
    return { ...storedUserReview, status: "inProgress", archivedAt: null };
  }

  if (storedUserReview.status === "completed") {
    return { ...storedUserReview, status: "completed", archivedAt: null };
  }

  return { ...storedUserReview, status: "active", archivedAt: null };
}
