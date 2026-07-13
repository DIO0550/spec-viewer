import type { OpenWorkspaceOutcome } from "@/features/workspace/application/openWorkspace";
import { WorkspacePath } from "@/features/workspace/domain/workspacePath";
import { getUnknownErrorMessage } from "@/shared/lib/errorMessage";

const invalidDroppedDirectoryMessage =
  "ワークスペースフォルダをドロップしてください。ファイルはワークスペースとして開けません。";
const missingSavedWorkspaceMessage =
  "ワークスペースが見つかりません。保存済み一覧から削除しました。";
const unsupportedSavedWorkspaceMessage =
  "対応していないワークスペースです。保存済み一覧から削除しました。";

export type OpenWorkspacePresentation =
  | Readonly<{ type: "none" }>
  | Readonly<{ type: "dropError"; message: string }>
  | Readonly<{
      type: "recentFailure";
      message: string;
      rollbackInput: string;
    }>;

/**
 * @param outcome - Framework-independent workspace open outcome.
 * @returns Localized UI feedback and rollback values.
 */
export function presentOpenWorkspaceOutcome(
  outcome: OpenWorkspaceOutcome,
): OpenWorkspacePresentation {
  if (outcome.type === "validationFailed") {
    return {
      type: "dropError",
      message: getUnknownErrorMessage(outcome.cause),
    };
  }

  if (
    outcome.type === "rejected" &&
    outcome.source === "drop" &&
    outcome.reason === "notDirectory"
  ) {
    return { type: "dropError", message: invalidDroppedDirectoryMessage };
  }

  if (outcome.type === "recentRemoved") {
    return {
      type: "recentFailure",
      message: presentRecentFailureMessage(outcome),
      rollbackInput:
        outcome.rollbackPath === null
          ? ""
          : WorkspacePath.toString(outcome.rollbackPath),
    };
  }

  return { type: "none" };
}

/**
 * @param outcome - Removed recent workspace outcome.
 * @returns The localized message for a removed recent workspace.
 */
function presentRecentFailureMessage(
  outcome: Extract<OpenWorkspaceOutcome, { type: "recentRemoved" }>,
): string {
  if (outcome.reason === "unsupported") {
    return unsupportedSavedWorkspaceMessage;
  }

  if (outcome.reason === "validationFailed") {
    return `${missingSavedWorkspaceMessage} ${getUnknownErrorMessage(outcome.cause)}`;
  }

  return missingSavedWorkspaceMessage;
}
