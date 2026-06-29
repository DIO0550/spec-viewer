import type {
  ListUserReviewsRequest,
  ListUserReviewsResponse,
} from "@/features/review-runs/types/userReviewIpc";

import { invokeTauriCommand } from "./invokeTauriCommand";

/** @returns Active and archived review runs for the selected review target. */
export async function listUserReviews(
  request: ListUserReviewsRequest,
): Promise<ListUserReviewsResponse> {
  return invokeTauriCommand("list_user_reviews", request);
}
