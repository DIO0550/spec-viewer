export type UserReviewRecordProblemKind =
  | "legacyRecord"
  | "unsupportedRecordVersion"
  | "malformedRecord"
  | "recoverableDuplicate"
  | "conflictingCopies";

export type UserReviewRecordProblem = Readonly<{
  locator: string;
  kind: UserReviewRecordProblemKind;
  message: string;
}>;
