import {
  mapUserReviewDtoToDomain,
  type UserReviewDto,
} from "@/features/review-runs/infra/tauri/userReviewIpcCodec";
import type { ListUserReviewsResponse } from "@/features/review-runs/types/userReviewIpc";

/** @returns A DTO restored through the review-run domain factory. */
export function mapUserReviewDtoToUserReview(review: UserReviewDto) {
  return mapUserReviewDtoToDomain("user_review_adapter", review, "$");
}

/** @returns A list response restored through the review-run domain factory. */
export function mapListUserReviewsResponseToUserReviews(
  response: Readonly<{
    active: readonly UserReviewDto[];
    archived: readonly UserReviewDto[];
    problems: ListUserReviewsResponse["problems"];
  }>,
): ListUserReviewsResponse {
  return {
    active: response.active.map(mapUserReviewDtoToUserReview),
    archived: response.archived.map(mapUserReviewDtoToUserReview),
    problems: response.problems,
  };
}
