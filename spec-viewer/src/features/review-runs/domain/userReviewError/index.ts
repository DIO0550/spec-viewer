export type UserReviewFeatureErrorCode =
  | "invalidRequest"
  | "workspaceDetection"
  | "configLoad"
  | "invalidSpec"
  | "invalidComment"
  | "commentRepository"
  | "invalidUserReview"
  | "userReviewCollision"
  | "userReviewRepository"
  | "unexpected"
  | "userReviewExport"
  | "unknown";

export type UserReviewFeatureError = Readonly<{
  feature?: "userReviews";
  code: UserReviewFeatureErrorCode | string;
  message: string;
  cause?: unknown;
  /** @deprecated Compatibility field for legacy normalized fixtures. */
  raw?: unknown;
}>;
