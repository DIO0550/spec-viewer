import type {
  ArchiveUserReviewRequest,
  ArchiveUserReviewResponse,
} from "@/features/review-runs/types/userReviewIpc";

import { invokeTauriCommand } from "./invokeTauriCommand";

/** @returns Metadata for the archived review run after moving it out of active. */
export async function archiveUserReview(
  request: ArchiveUserReviewRequest,
): Promise<ArchiveUserReviewResponse> {
  return invokeTauriCommand("archive_user_review", request);
}
