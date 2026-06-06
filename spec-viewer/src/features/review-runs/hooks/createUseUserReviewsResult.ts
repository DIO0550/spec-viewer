import type { UserReviewListState } from "@/features/review-runs/domain/userReviewListState";
import type { UserReviewTarget } from "@/features/review-runs/domain/userReviewTarget";
import type { UseUserReviewOperationsResult } from "@/features/review-runs/hooks/useUserReviewOperations";
import type { UseUserReviewsResult } from "@/features/review-runs/hooks/useUserReviews";

export type CreateUseUserReviewsResultInput = Readonly<{
  target: UserReviewTarget | null;
  listState: UserReviewListState;
  userReviewOperations: UseUserReviewOperationsResult;
  reloadUserReviews: () => Promise<boolean>;
}>;

/**
 * @param input - Current target, list state, operation callbacks, and reload function.
 * @returns Public result object exposed by useUserReviews.
 */
export function createUseUserReviewsResult({
  target,
  listState,
  userReviewOperations,
  reloadUserReviews,
}: CreateUseUserReviewsResultInput): UseUserReviewsResult {
  return {
    target,
    listState,
    createState: userReviewOperations.createState,
    archiveState: userReviewOperations.archiveState,
    activeReviews: listState.active,
    archivedReviews: listState.archived,
    reloadUserReviews,
    createUserReview: userReviewOperations.createUserReview,
    archiveUserReview: userReviewOperations.archiveUserReview,
  };
}
