import type { UserReviewError } from "@/features/review-runs/domain/userReviewError";
import type {
  UserReviewArchiveState,
  UserReviewCreateState,
} from "@/features/review-runs/domain/userReviewOperation";
import type { UserReviewListState } from "@/features/review-runs/domain/userReviewListState";

export type UserReviewFeatureErrorCode =
  | "invalidRequest"
  | "invalidComment"
  | "commentRepository"
  | "userReviewExport"
  | "unknown";

export type UserReviewFeatureError = Readonly<{
  feature: "userReviews";
  code: UserReviewFeatureErrorCode;
  message: string;
  domainError: UserReviewError;
  cause: unknown;
}>;

export type UserReviewArchiveFeatureState =
  UserReviewArchiveState<UserReviewFeatureError>;
export type UserReviewCreateFeatureState =
  UserReviewCreateState<UserReviewFeatureError>;
export type UserReviewListFeatureState =
  UserReviewListState<UserReviewFeatureError>;
