import type {
  ArchiveUserReviewRequest,
  ArchiveUserReviewResponse,
  CreateUserReviewRequest,
  CreateUserReviewResponse,
  ListUserReviewsRequest,
  ListUserReviewsResponse,
} from "@/features/review-runs/types/userReviewIpc";

import { archiveUserReview } from "./archiveUserReview";
import { createUserReview } from "./createUserReview";
import { listUserReviews } from "./listUserReviews";

export type UserReviewCommands = Readonly<{
  /**
   * Creates a new user review.
   * @param request - Create user review request.
   */
  createUserReview: (
    request: CreateUserReviewRequest,
  ) => Promise<CreateUserReviewResponse>;
  /**
   * Lists user reviews.
   * @param request - List user reviews request.
   */
  listUserReviews: (
    request: ListUserReviewsRequest,
  ) => Promise<ListUserReviewsResponse>;
  /**
   * Archives a user review.
   * @param request - Archive user review request.
   */
  archiveUserReview: (
    request: ArchiveUserReviewRequest,
  ) => Promise<ArchiveUserReviewResponse>;
}>;

export const userReviewCommands: UserReviewCommands = {
  createUserReview,
  listUserReviews,
  archiveUserReview,
};
