export type { CommentCommands } from "./application/ports/commentCommands";
export { AddCommentPopover } from "@/features/comments/components/AddCommentPopover";
export { CommentSidebar } from "@/features/comments/components/CommentSidebar";
export { Comment } from "@/features/comments/domain/comment";
export { Comments } from "@/features/comments/domain/comments";
export type {
  AddCommentSubmitInput,
  CommentAnchor,
  CommentAnchorDisplayState,
  CommentExportOperation,
  CommentExportScope,
  CommentId,
  ExportCommentsResponse,
  ExportCommentsTarget,
  GenerateLlmPromptResponse,
  SpecSkillMcpFeedbackPayload,
} from "@/features/comments/types/comment";
export { CommentThread } from "./components/CommentThread";
export { CommentListState } from "./domain/commentListState";
export type { CommentListFeatureState } from "./application/commentError";
export {
  CommentOperationFailedState,
  CommentOperationIdleState,
  type CommentOperationKind,
  CommentOperationSavingState,
} from "./domain/commentOperation";
export type { CommentOperationFeatureState as CommentOperationState } from "./application/commentError";
export { CommentScope } from "./domain/commentScope";
export { CommentStatusFilter } from "./domain/commentStatusFilter";
export { useComments } from "./hooks/useComments";
export { createTextHash } from "./lib/comment-anchor-draft";
export {
  createSpecSkillMcpFeedbackDryRunPayload,
  renderSpecSkillMcpFeedbackDryRunPayload,
} from "./lib/mcpFeedback";
export {
  exportComments,
  generateLlmPrompt,
  selectCommentExportDestination,
} from "./infra/tauri";
export { toCommentFeatureError } from "./infra/tauri/commentErrorMapper";
