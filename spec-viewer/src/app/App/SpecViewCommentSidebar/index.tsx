import type { ReactElement } from "react";
import type { SpecViewResetKeys } from "@/app/App/hooks/types";
import { useCommentExport } from "@/app/App/hooks/useCommentExport";
import { SpecViewUserReviewPanel } from "@/app/App/SpecViewUserReviewPanel";
import {
  type Comment,
  type CommentAnchorDisplayState,
  type CommentId,
  type CommentOperationState,
  CommentSidebar,
} from "@/features/comments";
import type { CommentListState } from "@/features/comments/domain/commentListState";

export type SpecViewCommentSidebarProps = Readonly<{
  comments: readonly Comment[];
  correlationId: string | null;
  resetKeys: SpecViewResetKeys;
  listState: CommentListState;
  operationState: CommentOperationState;
  activeCommentId: CommentId | null;
  anchorDisplayStates: readonly CommentAnchorDisplayState[];
  onSelectComment: (commentId: CommentId) => void;
  onResolveComment: (commentId: CommentId) => void;
  onReopenComment: (commentId: CommentId) => void;
  onDeleteComment: (commentId: CommentId) => void;
  onUpdateComment: (commentId: CommentId, body: string) => Promise<boolean>;
  onReloadComments: () => void;
}>;

/**
 * @param props - Shared comment state/handlers plus the export scope and correlation id.
 * @returns Comment sidebar wrapper that owns export/LLM/MCP progress state locally.
 */
export function SpecViewCommentSidebar(
  props: SpecViewCommentSidebarProps,
): ReactElement {
  const commentExport = useCommentExport({
    resetKeys: props.resetKeys,
    comments: props.comments,
  });

  return (
    <CommentSidebar
      listState={props.listState}
      operationState={props.operationState}
      exportState={commentExport.commentExportState}
      activeCommentId={props.activeCommentId}
      anchorDisplayStates={props.anchorDisplayStates}
      onSelectComment={props.onSelectComment}
      onResolveComment={props.onResolveComment}
      onReopenComment={props.onReopenComment}
      onDeleteComment={props.onDeleteComment}
      onUpdateComment={props.onUpdateComment}
      onReload={props.onReloadComments}
      onExportComments={commentExport.exportCommentScope}
      onCopyLlmPrompt={commentExport.copyLlmPromptScope}
      onCopyMcpFeedback={commentExport.copyMcpFeedbackPayload}
      userReviewPanel={
        <SpecViewUserReviewPanel
          comments={props.comments}
          correlationId={props.correlationId}
          resetKeys={props.resetKeys}
        />
      }
    />
  );
}
