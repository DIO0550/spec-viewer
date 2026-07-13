import type {
  ActiveUserReview,
  ArchivedUserReview,
} from "@/features/review-runs/domain/userReview";
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
  /** Reloads the user review list. */
  reloadUserReviews: () => Promise<boolean>;
}>;

type UserReviewsOperationResultInput = Readonly<{
  createState: UserReviewCreateState;
  archiveState: UserReviewArchiveState;
  /** @returns True when the current selection can create a review. */
  canCreateUserReview: (input: CreateUserReviewInput) => boolean;
  /** Creates a user review. @param input - The create-review input. */
  createUserReview: (
    input: CreateUserReviewInput,
  ) => Promise<ActiveUserReview | null>;
  /** Archives a user review. @param userReview - Aggregate to archive. */
  archiveUserReview: (
    userReview: ActiveUserReview,
  ) => Promise<ArchivedUserReview | null>;
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

  const { canCreateUserReview } = input.operations;
  return {
    target,
    listState,
    createState,
    archiveState,
    activeReviews: listState.active,
    archivedReviews: listState.archived,
    reloadUserReviews,
    createUserReview,
    canCreateUserReview,
    archiveUserReview,
  };
};
