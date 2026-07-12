export type UserReviewErrorReason =
  | "requestRejected"
  | "commentRejected"
  | "commentReadFailed"
  | "reviewExportFailed"
  | "unexpectedFailure";

export type UserReviewError = Readonly<{
  reason: UserReviewErrorReason;
}>;
