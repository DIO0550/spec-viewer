import type { IpcCommandError } from "@/shared/types/ipc";

export type WorkspaceErrorReason =
  | "invalidSelection"
  | "detectionFailed"
  | "configLoadFailed"
  | "unknown";

export type WorkspaceError = Readonly<{
  reason: WorkspaceErrorReason;
  message: string;
  cause: IpcCommandError;
}>;

/** @returns A workspace-domain error converted from a low-level IPC error. */
export function toWorkspaceError(error: IpcCommandError): WorkspaceError {
  return {
    reason: toWorkspaceErrorReason(error.code),
    message: error.message,
    cause: error,
  };
}

/** @returns The workspace-domain reason for a low-level command code. */
function toWorkspaceErrorReason(
  code: IpcCommandError["code"],
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
