import type { LoadWorkspaceCommandError } from "@/shared/api/tauri/loadWorkspace";

export type WorkspaceErrorReason =
  | "invalidSelection"
  | "detectionFailed"
  | "configLoadFailed"
  | "unknown";

export type LegacyWorkspaceCommandError = Readonly<{
  code: LoadWorkspaceCommandError["code"] | string;
  message: string;
  raw: unknown;
}>;

export type WorkspaceError = Readonly<{
  reason: WorkspaceErrorReason;
  message: string;
  cause: LoadWorkspaceCommandError | LegacyWorkspaceCommandError;
}>;

/** @returns A workspace-domain error converted from a load_workspace command error. */
export function toWorkspaceError(
  error: LoadWorkspaceCommandError | LegacyWorkspaceCommandError,
): WorkspaceError {
  return {
    reason: toWorkspaceErrorReason(error.code),
    message: error.message,
    cause: error,
  };
}

/** @returns The workspace-domain reason for a load_workspace command code. */
function toWorkspaceErrorReason(
  code: (LoadWorkspaceCommandError | LegacyWorkspaceCommandError)["code"],
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
