import type { UserReviewListState } from "@/features/review-runs/domain/userReviewListState";
import type { UserReviewTarget } from "@/features/review-runs/domain/userReviewTarget";
import type { UseUserReviewOperationsResult } from "@/features/review-runs/hooks/useUserReviewOperations";
import type { UseUserReviewsResult } from "@/features/review-runs/hooks/useUserReviews";

type UserReviewsListResultInput = Readonly<{
  target: UserReviewTarget | null;
  listState: UserReviewListState;
  reloadUserReviews: () => Promise<boolean>;
}>;

type UserReviewsOperationResultInput = Readonly<{
  createState: UseUserReviewOperationsResult["createState"];
  archiveState: UseUserReviewOperationsResult["archiveState"];
  createUserReview: UseUserReviewOperationsResult["createUserReview"];
  archiveUserReview: UseUserReviewOperationsResult["archiveUserReview"];
}>;

type UserReviewsResultInput = Readonly<{
  list: UserReviewsListResultInput;
  operations: UserReviewsOperationResultInput;
}>;

type UserReviewsResultBuilder = (
  input: UserReviewsResultInput,
) => UseUserReviewsResult;

/**
 * @param input - UI hook side list/reload input and operation input.
 * @returns Public result object exposed by useUserReviews.
 */
export const buildUserReviewsResult: UserReviewsResultBuilder = (input) => {
  const { target, listState, reloadUserReviews } = input.list;
  const {
    createState,
    archiveState,
    createUserReview,
    archiveUserReview,
  } = input.operations;

  return {
    target,
    listState,
    createState,
    archiveState,
    activeReviews: listState.active,
    archivedReviews: listState.archived,
    reloadUserReviews,
    createUserReview,
    archiveUserReview,
  };
};
