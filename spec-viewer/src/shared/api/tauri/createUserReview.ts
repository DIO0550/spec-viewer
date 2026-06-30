import type {
  CreateUserReviewRequest,
  CreateUserReviewResponse,
} from "@/features/review-runs/types/userReviewIpc";

import { invokeTauriCommand } from "./invokeTauriCommand";

/** @returns Metadata for the active review run bundle created by the backend. */
export async function createUserReview(
  request: CreateUserReviewRequest,
): Promise<CreateUserReviewResponse> {
  return invokeTauriCommand("create_user_review", request);
}
