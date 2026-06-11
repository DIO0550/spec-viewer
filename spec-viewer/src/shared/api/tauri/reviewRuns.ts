import type {
  ArchiveUserReviewRequest,
  ArchiveUserReviewResponse,
  CreateUserReviewRequest,
  CreateUserReviewResponse,
  ListUserReviewsRequest,
  ListUserReviewsResponse,
} from "@/features/review-runs/types/userReviewIpc";

import { invokeCommand } from "./invokeCommand";

export type UserReviewCommands = Readonly<{
  /** Creates a new review run bundle for the requested target. */
  createUserReview: (
    request: CreateUserReviewRequest,
  ) => Promise<CreateUserReviewResponse>;
  /** Lists active and archived review runs for the requested target. */
  listUserReviews: (
    request: ListUserReviewsRequest,
  ) => Promise<ListUserReviewsResponse>;
  /** Archives the review run identified by the request. */
  archiveUserReview: (
    request: ArchiveUserReviewRequest,
  ) => Promise<ArchiveUserReviewResponse>;
}>;

/**
 * @param request - Review target and workspace mode.
 * @returns Metadata for the active review run bundle created by the backend.
 */
export async function createUserReview(
  request: CreateUserReviewRequest,
): Promise<CreateUserReviewResponse> {
  return invokeCommand("create_user_review", request);
}

/**
 * @param request - Review target to list runs for.
 * @returns Active and archived review runs for the selected review target.
 */
export async function listUserReviews(
  request: ListUserReviewsRequest,
): Promise<ListUserReviewsResponse> {
  return invokeCommand("list_user_reviews", request);
}

/**
 * @param request - Review run id to archive.
 * @returns Metadata for the archived review run after moving it out of active.
 */
export async function archiveUserReview(
  request: ArchiveUserReviewRequest,
): Promise<ArchiveUserReviewResponse> {
  return invokeCommand("archive_user_review", request);
}

export const userReviewCommands: UserReviewCommands = {
  createUserReview,
  listUserReviews,
  archiveUserReview,
};
