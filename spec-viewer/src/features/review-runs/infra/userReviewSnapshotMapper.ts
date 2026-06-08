import {
  UserReviewStatus,
  type UserReview,
  type UserReviewArchiveStateError,
  type UserReviewSnapshot,
} from "@/features/review-runs/domain/userReview";

export const UserReviewSnapshotMapper = {
  /** @returns User review restored from a boundary snapshot. */
  fromSnapshot(snapshot: UserReviewSnapshot): UserReview {
    const result = UserReviewSnapshotMapper.tryFromSnapshot(snapshot);

    if (!result.ok) {
      throw new Error(result.error.message);
    }

    return result.userReview;
  },

  /** @returns Restore result without throwing for archive state inconsistencies. */
  tryFromSnapshot(
    snapshot: UserReviewSnapshot,
  ):
    | Readonly<{
        ok: true;
        userReview: UserReview;
      }>
    | Readonly<{
        ok: false;
        error: UserReviewArchiveStateError;
      }> {
    const error = validateArchiveState(snapshot);

    if (error !== null) {
      return {
        ok: false,
        error,
      };
    }

    return {
      ok: true,
      userReview: snapshot as UserReview,
    };
  },
} as const;

/** @returns Archive state error, or null when status and archivedAt are consistent. */
function validateArchiveState(
  snapshot: UserReviewSnapshot,
): UserReviewArchiveStateError | null {
  if (
    UserReviewStatus.isArchived(snapshot.status) &&
    snapshot.archivedAt === null
  ) {
    return {
      reason: "archivedMissingArchivedAt",
      id: snapshot.id,
      message: `Archived user review must have archivedAt: ${snapshot.id}`,
    };
  }

  if (
    UserReviewStatus.isNonArchived(snapshot.status) &&
    snapshot.archivedAt !== null
  ) {
    return {
      reason: "nonArchivedHasArchivedAt",
      id: snapshot.id,
      message: `Non-archived user review must not have archivedAt: ${snapshot.id}`,
    };
  }

  return null;
}
