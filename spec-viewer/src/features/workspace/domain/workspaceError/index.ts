import type { LoadWorkspaceCommandError } from "@/lib/api/tauri/loadWorkspace";

export type WorkspaceErrorReason =
  | "invalidSelection"
  | "detectionFailed"
  | "configLoadFailed"
  | "unknown";

export type WorkspaceError = Readonly<{
  reason: WorkspaceErrorReason;
  message: string;
  cause: LoadWorkspaceCommandError;
}>;

/** @returns A workspace-domain error converted from a load_workspace command error. */
export function toWorkspaceError(
  error: LoadWorkspaceCommandError,
): WorkspaceError {
  return {
    reason: toWorkspaceErrorReason(error.code),
    message: error.message,
    cause: error,
  };
}

/** @returns The workspace-domain reason for a load_workspace command code. */
function toWorkspaceErrorReason(
  /** @param code - 変換対象の load_workspace コマンドエラーコード。 */
  code: LoadWorkspaceCommandError["code"],
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
