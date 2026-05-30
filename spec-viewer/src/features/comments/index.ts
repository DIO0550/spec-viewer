export { AddCommentPopover } from "@/features/comments/components/AddCommentPopover";
export { Comment } from "@/features/comments/domain/comment";
export { Comments } from "@/features/comments/domain/comments";
export { CommentSidebar } from "@/features/comments/components/CommentSidebar";
export { CommentThread } from "./components/CommentThread";
export {
  CommentOperationFailedState,
  CommentOperationIdleState,
  CommentOperationSavingState,
  type CommentOperationKind,
  type CommentOperationState,
} from "./domain/commentOperation";
export { useComments } from "./hooks/useComments";
export { createTextHash } from "./lib/comment-anchor-draft";
export {
  createSpecSkillMcpFeedbackDryRunPayload,
  renderSpecSkillMcpFeedbackDryRunPayload,
} from "./lib/mcpFeedback";
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
