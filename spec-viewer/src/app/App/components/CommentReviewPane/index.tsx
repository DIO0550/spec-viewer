import { CommentSidebar } from "@/features/comments";
import { Comments } from "@/features/comments/domain/comments";
import type { UseCommentActionsResult } from "@/features/comments/hooks/useCommentActions";
import type { UseCommentExportResult } from "@/features/comments/hooks/useCommentExport";
import type { UseCommentSelectionResult } from "@/features/comments/hooks/useCommentSelection";
import type { UseCommentsResult } from "@/features/comments/hooks/useComments";
import type { CommentId } from "@/features/comments/types/comment";
import { UserReviewPanel } from "@/features/review-runs";
import type { UseUserReviewPanelStateResult } from "@/features/review-runs/hooks/useUserReviewPanelState";
import type { UseUserReviewsResult } from "@/features/review-runs/hooks/useUserReviews";
import { copyTextToClipboard } from "@/shared/lib/clipboard";

type Props = Readonly<{
  comments: UseCommentsResult;
  selection: UseCommentSelectionResult;
  actions: UseCommentActionsResult;
  commentExport: UseCommentExportResult;
  userReviews: UseUserReviewsResult;
  panelState: UseUserReviewPanelStateResult;
  /** @param commentId - Comment selected in the sidebar */
  onSelectComment: (commentId: CommentId) => void;
}>;

/** @returns The comment sidebar pane combined with the user review panel. */
export function CommentReviewPane({
  comments,
  selection,
  actions,
  commentExport,
  userReviews,
  panelState,
  onSelectComment,
}: Props) {
  /** Creates a user review bundle from the currently open comments. */
  const createUserReviewFromOpenComments = async (): Promise<void> => {
    await userReviews.createUserReview({
      commentIds: Comments.openCommentIds(comments.comments),
      workspaceMode: panelState.workspaceMode,
    });
  };

  return (
    <CommentSidebar
      listState={comments.listState}
      operationState={comments.operationState}
      exportState={commentExport.exportState}
      activeCommentId={selection.activeCommentId}
      anchorDisplayStates={selection.anchorDisplayStates}
      onSelectComment={onSelectComment}
      onResolveComment={actions.resolveComment}
      onReopenComment={actions.reopenComment}
      onDeleteComment={actions.deleteComment}
      onUpdateComment={actions.updateComment}
      onReload={() => {
        void comments.reloadComments();
      }}
      onExportComments={commentExport.exportCommentScope}
      onCopyLlmPrompt={commentExport.copyLlmPromptScope}
      onCopyMcpFeedback={commentExport.copyMcpFeedback}
      userReviewPanel={
        <UserReviewPanel
          targetScope={panelState.targetScope}
          workspaceMode={panelState.workspaceMode}
          openCommentCount={Comments.countOpen(comments.comments)}
          listState={userReviews.listState}
          createState={userReviews.createState}
          archiveState={userReviews.archiveState}
          onTargetScopeChange={panelState.changeTargetScope}
          onWorkspaceModeChange={panelState.changeWorkspaceMode}
          onCreateUserReview={() => {
            void createUserReviewFromOpenComments();
          }}
          onArchiveUserReview={(userReviewId) => {
            void userReviews.archiveUserReview(userReviewId);
          }}
          onRefreshUserReviews={() => {
            void userReviews.reloadUserReviews();
          }}
          onCopyPath={copyTextToClipboard}
        />
      }
    />
  );
}
