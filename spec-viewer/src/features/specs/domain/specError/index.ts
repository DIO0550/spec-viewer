export type SpecErrorReason =
  | "specRejected"
  | "treeReadFailed"
  | "archiveFailed"
  | "documentReadFailed"
  | "requestRejected"
  | "unexpectedFailure";

export type SpecError = Readonly<{
  reason: SpecErrorReason;
}>;
