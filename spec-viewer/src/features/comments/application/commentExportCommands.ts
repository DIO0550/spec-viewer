import type {
  ExportCommentsRequest,
  ExportCommentsResponse,
  ExportCommentsTarget,
  GenerateLlmPromptRequest,
  GenerateLlmPromptResponse,
} from "@/features/comments/types/comment";

/** Comment export capabilities supplied by composition. */
export type CommentExportCommands = Readonly<{
  exportComments: (
    request: ExportCommentsRequest,
  ) => Promise<ExportCommentsResponse>;
  generateLlmPrompt: (
    request: GenerateLlmPromptRequest,
  ) => Promise<GenerateLlmPromptResponse>;
  selectCommentExportDestination: (
    target: ExportCommentsTarget,
  ) => Promise<string | null>;
}>;
