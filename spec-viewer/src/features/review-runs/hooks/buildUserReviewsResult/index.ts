import type { UserReview } from "@/features/review-runs/domain/userReview";
import type {
  UserReviewArchiveFeatureState,
  UserReviewCreateFeatureState,
  UserReviewListFeatureState,
} from "@/features/review-runs/application/userReviewError";
import type { UserReviewTarget } from "@/features/review-runs/domain/userReviewTarget";
import type { CreateUserReviewInput } from "@/features/review-runs/hooks/useCreateUserReview";
import type { UseUserReviewsResult } from "@/features/review-runs/hooks/useUserReviews";

type UserReviewsListResultInput = Readonly<{
  target: UserReviewTarget | null;
  listState: UserReviewListFeatureState;
  /** Reloads the user review list. */
  reloadUserReviews: () => Promise<boolean>;
}>;

type UserReviewsOperationResultInput = Readonly<{
  createState: UserReviewCreateFeatureState;
  archiveState: UserReviewArchiveFeatureState;
  /** Creates a user review. @param input - The create-review input. */
  createUserReview: (
    input: CreateUserReviewInput,
  ) => Promise<UserReview | null>;
  /** Archives a user review. @param userReviewId - ID of the review to archive. */
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
  const { createState, archiveState, createUserReview, archiveUserReview } =
    input.operations;

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
