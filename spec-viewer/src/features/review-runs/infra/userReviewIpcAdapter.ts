import { UserReview } from "@/features/review-runs/domain/userReview";
import type {
  ListUserReviewsResponse,
  UserReviewDto,
} from "@/features/review-runs/types/userReviewIpc";

/**
 * @param review - User review DTO returned from the command boundary.
 * @returns Domain-validated user review DTO.
 * @throws Error when lifecycle invariants are invalid.
 */
export function normalizeUserReviewDto(review: UserReviewDto): UserReviewDto {
  UserReview.restore(review);

  return review;
}

/**
 * @param response - List response returned from the command boundary.
 * @returns Response with every user review lifecycle-validated.
 * @throws Error when any user review lifecycle invariant is invalid.
 */
export function normalizeListUserReviewsResponse(
  response: ListUserReviewsResponse,
): ListUserReviewsResponse {
  return {
    active: response.active.map(normalizeUserReviewDto),
    archived: response.archived.map(normalizeUserReviewDto),
    problems: response.problems,
  };
}
