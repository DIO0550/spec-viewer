/** Existing command-shaped cause, retained until the error-model cleanup in #109. */
export type WorkspaceErrorCause = Readonly<{
  command: "load_workspace";
  code:
    | "invalidRequest"
    | "workspaceDetection"
    | "configLoad"
    | "unexpected"
    | "unknown";
  message: string;
  raw: unknown;
}>;

export type WorkspaceErrorReason =
  | "invalidSelection"
  | "detectionFailed"
  | "configLoadFailed"
  | "unknown";

export type WorkspaceError = Readonly<{
  reason: WorkspaceErrorReason;
  message: string;
  cause: WorkspaceErrorCause;
}>;

/** @returns A workspace-domain error converted from a load_workspace command error. */
function toWorkspaceError(error: WorkspaceErrorCause): WorkspaceError {
  return {
    reason: toWorkspaceErrorReason(error.code),
    message: error.message,
    cause: error,
  };
}

/** @returns The workspace-domain reason for a load_workspace command code. */
function toWorkspaceErrorReason(
  /** @param code - 変換対象の load_workspace コマンドエラーコード。 */
  code: WorkspaceErrorCause["code"],
): WorkspaceErrorReason {
  if (code === "invalidRequest") {
    return "invalidSelection";
  }

  if (code === "workspaceDetection") {
    return "detectionFailed";
  }

  if (code === "configLoad") {
    return "configLoadFailed";
  }

  return "unknown";
}

export const WorkspaceError = {
  fromCommand: toWorkspaceError,
} as const;
