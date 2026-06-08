import type {
  UserReview,
  UserReviewArchiveStateError,
  UserReviewSnapshot,
} from "@/features/review-runs/domain/userReview";
import { UserReviewSnapshotMapper } from "@/features/review-runs/infra/userReviewSnapshotMapper";
import type {
  ListUserReviewsResponse,
} from "@/features/review-runs/types/userReviewIpc";

/**
 * @param review - User review DTO returned from the command boundary.
 * @returns Domain-validated user review DTO.
 * @throws Error when lifecycle invariants are invalid.
 */
export function mapUserReviewDtoToUserReview(
  review: UserReviewSnapshot,
): UserReview {
  const result = UserReviewSnapshotMapper.tryFromSnapshot(review);

  if (!result.ok) {
    throw toUserReviewArchiveStateError(result.error);
  }

  return result.userReview;
}

/**
 * @param response - List response returned from the command boundary.
 * @returns Response with every user review lifecycle-validated.
 * @throws Error when any user review lifecycle invariant is invalid.
 */
export function mapListUserReviewsResponseToUserReviews(
  response: ListUserReviewsResponse,
): ListUserReviewsResponse {
  return {
    active: response.active.map(mapUserReviewDtoToUserReview),
    archived: response.archived.map(mapUserReviewDtoToUserReview),
    problems: response.problems,
  };
}

/** @returns Boundary-compatible error for archive state inconsistencies. */
function toUserReviewArchiveStateError(
  error: UserReviewArchiveStateError,
): Error {
  return new Error(error.message);
}
