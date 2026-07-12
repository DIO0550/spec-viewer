export type CommentErrorReason =
  | "commentRejected"
  | "commentPersistenceFailed"
  | "requestRejected"
  | "unexpectedFailure";

export type CommentError = Readonly<{
  reason: CommentErrorReason;
}>;
