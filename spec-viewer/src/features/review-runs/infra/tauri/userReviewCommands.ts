import type { UserReviewCommands } from "@/features/review-runs/application/ports/userReviewCommands";

import { archiveUserReview } from "./archiveUserReview";
import { createUserReview } from "./createUserReview";
import { listUserReviews } from "./listUserReviews";

export const userReviewCommands: UserReviewCommands = {
  createUserReview,
  listUserReviews,
  archiveUserReview,
};
