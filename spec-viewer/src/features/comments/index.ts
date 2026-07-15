export { AddCommentPopover } from "@/features/comments/components/AddCommentPopover";
export { CommentSidebar } from "@/features/comments/components/CommentSidebar";
export { Comment } from "@/features/comments/domain/comment";
export {
  BlockIdentity,
  BlockIndex,
  BlockType,
  CharRange,
  CommentAnchor,
  TextHash,
  TextSnippet,
  type RenderedBlockType,
} from "@/features/comments/domain/commentAnchor";
export {
  CommentBody,
  type CommentBodyDraft,
  type CommentBodyParseError,
} from "@/features/comments/domain/commentBody";
export { Comments } from "@/features/comments/domain/comments";
export type {
  AddCommentSubmitInput,
  CommentAnchorDisplayState,
  CommentExportOperation,
  CommentExportScope,
  CommentId,
  ExportCommentsResponse,
  ExportCommentsTarget,
  GenerateLlmPromptResponse,
  SpecSkillMcpFeedbackPayload,
} from "@/features/comments/types/comment";
export type {
  CommentListFeatureState,
  CommentOperationFeatureState as CommentOperationState,
} from "./application/commentError";
export type { CommentCommands } from "./application/ports/commentCommands";
export { CommentThread } from "./components/CommentThread";
export { CommentListState } from "./domain/commentListState";
export {
  CommentOperationFailedState,
  CommentOperationIdleState,
  type CommentOperationKind,
  CommentOperationSavingState,
} from "./domain/commentOperation";
export { CommentScope } from "./domain/commentScope";
export { CommentStatusFilter } from "./domain/commentStatusFilter";
export { useComments } from "./hooks/useComments";
export {
  exportComments,
  generateLlmPrompt,
  selectCommentExportDestination,
} from "./infra/tauri";
export { toCommentFeatureError } from "./infra/tauri/commentErrorMapper";
export { toCommentBodyValidationMessage } from "./lib/comment-body-validation-message";
export {
  createSpecSkillMcpFeedbackDryRunPayload,
  renderSpecSkillMcpFeedbackDryRunPayload,
} from "./lib/mcpFeedback";
