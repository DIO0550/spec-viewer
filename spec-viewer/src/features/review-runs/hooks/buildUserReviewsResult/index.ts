import type { UserReview } from "@/features/review-runs/domain/userReview";
import type { UserReviewListState } from "@/features/review-runs/domain/userReviewListState";
import type {
  UserReviewArchiveState,
  UserReviewCreateState,
} from "@/features/review-runs/domain/userReviewOperation";
import type { UserReviewTarget } from "@/features/review-runs/domain/userReviewTarget";
import type { CreateUserReviewInput } from "@/features/review-runs/hooks/useCreateUserReview";
import type { UseUserReviewsResult } from "@/features/review-runs/hooks/useUserReviews";

type UserReviewsListResultInput = Readonly<{
  target: UserReviewTarget | null;
  listState: UserReviewListState;
  reloadUserReviews: () => Promise<boolean>;
}>;

type UserReviewsOperationResultInput = Readonly<{
  createState: UserReviewCreateState;
  archiveState: UserReviewArchiveState;
  createUserReview: (
    input: CreateUserReviewInput,
  ) => Promise<UserReview | null>;
  archiveUserReview: (userReviewId: string) => Promise<UserReview | null>;
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
