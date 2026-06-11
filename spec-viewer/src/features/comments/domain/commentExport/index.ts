import type {
  CommentExportOperation,
  CommentExportScope,
  ExportCommentsResponse,
  ExportCommentsTarget,
  GenerateLlmPromptResponse,
  SpecSkillMcpFeedbackPayload,
} from "@/features/comments/types/comment";
import type { SpecFileKey } from "@/features/specs/types/spec";

export type CommentExportState =
  | Readonly<{
      status: "idle";
      operation: null;
      message: null;
    }>
  | Readonly<{
      status: "saving" | "success" | "error";
      operation: CommentExportOperation;
      message: string;
    }>;

type CreateTargetInput = Readonly<{
  scope: CommentExportScope;
  specId: string | null;
  fileKey: SpecFileKey | null;
}>;

const idleState: CommentExportState = {
  status: "idle",
  operation: null,
  message: null,
};

export const CommentExport = {
  /** The export state before any export operation has started. */
  idleState,
  /**
   * @param operation - Export operation in progress
   * @param message - Progress message displayed to the user
   * @returns A saving export state for the running operation.
   */
  savingState(
    operation: CommentExportOperation,
    message: string,
  ): CommentExportState {
    return { status: "saving", operation, message };
  },
  /**
   * @param operation - Export operation that finished
   * @param message - Success message displayed to the user
   * @returns A success export state for the finished operation.
   */
  successState(
    operation: CommentExportOperation,
    message: string,
  ): CommentExportState {
    return { status: "success", operation, message };
  },
  /**
   * @param operation - Export operation that failed
   * @param message - Error message displayed to the user
   * @returns An error export state for the failed operation.
   */
  errorState(
    operation: CommentExportOperation,
    message: string,
  ): CommentExportState {
    return { status: "error", operation, message };
  },
  /**
   * @param input - Export scope and the current spec file selection
   * @returns The export target, or null when the selection cannot satisfy the scope.
   */
  createTarget({
    scope,
    specId,
    fileKey,
  }: CreateTargetInput): ExportCommentsTarget | null {
    if (specId === null) {
      return null;
    }

    if (scope === "workspace") {
      return { scope };
    }

    if (scope === "spec") {
      return { scope, specId };
    }

    if (fileKey === null) {
      return null;
    }

    return { scope, specId, fileKey };
  },
  /**
   * @param response - Export command response
   * @returns A compact success message for exported comments.
   */
  formatExportSuccessMessage(response: ExportCommentsResponse): string {
    return `${response.commentCount}件のコメントを${response.destinationPath}へexportしました。`;
  },
  /**
   * @param response - LLM prompt generation response
   * @returns A compact success message for copied LLM prompt bundles.
   */
  formatLlmPromptCopySuccessMessage(
    response: GenerateLlmPromptResponse,
  ): string {
    return `${response.contextFileCount}ファイル / ${response.commentCount}件のコメントを含むLLM promptをコピーしました。`;
  },
  /**
   * @param payload - Copied MCP feedback dry-run payload
   * @returns A compact success message for copied Spec Skill MCP feedback dry-runs.
   */
  formatMcpFeedbackCopySuccessMessage(
    payload: SpecSkillMcpFeedbackPayload,
  ): string {
    return `${payload.summary.commentCount}件のコメントを${payload.interface.toolName}向けdry-run MCP feedback payloadとしてコピーしました。`;
  },
} as const;
