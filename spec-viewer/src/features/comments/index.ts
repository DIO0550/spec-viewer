export { AddCommentPopover } from "@/features/comments/components/AddCommentPopover";
export {
  MarkdownCommentLayer,
  type MarkdownCommentLayerProps,
} from "@/features/comments/components/MarkdownCommentLayer";
export { CommentComposer } from "@/features/comments/components/CommentComposer";
export { CommentSidebar } from "@/features/comments/components/CommentSidebar";
export { Comment } from "@/features/comments/domain/comment";
export type { CommentAnchor } from "@/features/comments/domain/commentAnchor";
export { CommentId } from "@/features/comments/domain/commentId";
export { Comments } from "@/features/comments/domain/comments";
export type {
  AddCommentSubmitInput,
  CommentAnchorDisplayState,
  CommentExportOperation,
  CommentExportScope,
  ExportCommentsResponse,
  ExportCommentsTarget,
  GenerateLlmPromptResponse,
  SpecSkillMcpFeedbackPayload,
} from "@/features/comments/types/comment";
export { CommentThread } from "./components/CommentThread";
export {
  CommentOperationFailedState,
  CommentOperationIdleState,
  type CommentOperationKind,
  CommentOperationSavingState,
  type CommentOperationState,
} from "./domain/commentOperation";
export { useComments } from "./hooks/useComments";
export {
  type MarkdownViewerCommentActions,
  type MarkdownViewerCommentEditDraft,
  type UseMarkdownViewerCommentsResult,
  useMarkdownViewerComments,
} from "./hooks/useMarkdownViewerComments";
export { createTextHash } from "./lib/comment-anchor-draft";
export {
  createSpecSkillMcpFeedbackDryRunPayload,
  renderSpecSkillMcpFeedbackDryRunPayload,
} from "./lib/mcpFeedback";
