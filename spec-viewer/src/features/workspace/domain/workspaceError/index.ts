export type WorkspaceErrorReason =
  | "invalidSelection"
  | "detectionFailed"
  | "configLoadFailed"
  | "unexpectedFailure";

export type WorkspaceError = Readonly<{
  reason: WorkspaceErrorReason;
}>;
