import type {
  StoredUserReview,
  UserReviewArchiveStateError,
} from "@/features/review-runs/domain/userReview";
import { ValidatedStoredUserReview } from "@/features/review-runs/domain/validatedStoredUserReview";

/**
 * @param storedUserReview - Stored user review data read from a boundary.
 * @returns User review validated from stored user review data.
 */
export function validateStoredUserReview(
  storedUserReview: StoredUserReview,
): ValidatedStoredUserReview {
  const result = ValidatedStoredUserReview.from(storedUserReview);

  if (!result.ok) {
    throw new Error(result.error.message);
  }

  return result.validatedStoredUserReview;
}

/**
 * @param storedUserReview - Stored user review data read from a boundary.
 * @returns Validation result without throwing for archive state inconsistencies.
 */
export function tryValidateStoredUserReview(
  storedUserReview: StoredUserReview,
):
  | Readonly<{
      ok: true;
      validatedStoredUserReview: ValidatedStoredUserReview;
    }>
  | Readonly<{
      ok: false;
      error: UserReviewArchiveStateError;
    }> {
  return ValidatedStoredUserReview.from(storedUserReview);
}
