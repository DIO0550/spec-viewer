import type { WorkspaceFeatureError } from "@/features/workspace/application/workspaceError";
import type { WorkspaceErrorReason } from "@/features/workspace/domain/workspaceError";
import { LoadWorkspaceCommandError } from "@/features/workspace/infra/tauri/loadWorkspace";

/**
 * @param error - Unknown value rejected by the load_workspace boundary.
 * @returns Application error with a pure domain reason and stable display message.
 */
export function toWorkspaceFeatureError(error: unknown): WorkspaceFeatureError {
  const cause = LoadWorkspaceCommandError.fromUnknown(error);
  const reason = toWorkspaceErrorReason(cause.code);

  return {
    feature: "workspace",
    reason,
    message: cause.message,
    domainError: { reason },
    cause,
  };
}

/**
 * @param code - Parsed load_workspace command error code.
 * @returns The workspace domain reason for an infrastructure error code.
 */
function toWorkspaceErrorReason(
  code: LoadWorkspaceCommandError["code"],
): WorkspaceErrorReason {
  switch (code) {
    case "invalidRequest":
      return "invalidSelection";
    case "workspaceDetection":
      return "detectionFailed";
    case "configLoad":
      return "configLoadFailed";
    default:
      return "unexpectedFailure";
  }
}
