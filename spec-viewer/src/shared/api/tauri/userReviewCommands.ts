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
  createUserReview: (
    request: CreateUserReviewRequest,
  ) => Promise<CreateUserReviewResponse>;
  listUserReviews: (
    request: ListUserReviewsRequest,
  ) => Promise<ListUserReviewsResponse>;
  archiveUserReview: (
    request: ArchiveUserReviewRequest,
  ) => Promise<ArchiveUserReviewResponse>;
}>;

export const userReviewCommands: UserReviewCommands = {
  createUserReview,
  listUserReviews,
  archiveUserReview,
};
