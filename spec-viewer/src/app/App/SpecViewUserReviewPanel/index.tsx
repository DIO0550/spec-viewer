import type { ReactElement } from "react";
import type { SpecViewResetKeys } from "@/app/App/hooks/types";
import { useUserReviewWorkspaceMode } from "@/app/App/hooks/useUserReviewWorkspaceMode";
import { useSpecViewSelection } from "@/app/context/specViewSelection";
import { Comment, type CommentId } from "@/features/comments";
import { UserReviewPanel, useUserReviews } from "@/features/review-runs";
import { copyTextToClipboard } from "@/shared/lib/clipboard";

type UserReviewCommentSummary = Readonly<{
  id: CommentId;
  status: Comment["status"];
}>;

export type SpecViewUserReviewPanelProps = Readonly<{
  comments: readonly UserReviewCommentSummary[];
  correlationId: string | null;
  resetKeys: SpecViewResetKeys;
}>;

/**
 * @param props - Comment summaries, document correlation id and reset keys.
 * @returns User review panel wired to the app-level spec view selection.
 */
export function SpecViewUserReviewPanel(
  props: SpecViewUserReviewPanelProps,
): ReactElement {
  const { comments, correlationId } = props;
  const { workspaceMode, setWorkspaceMode } = useUserReviewWorkspaceMode({
    resetKeys: props.resetKeys,
  });
  const { selection, selectTargetScope } = useSpecViewSelection();
  const userReviews = useUserReviews({
    selection,
    correlationId,
  });

  return (
    <UserReviewPanel
      targetScope={selection.targetScope}
      workspaceMode={workspaceMode}
      openCommentCount={countOpenComments(comments)}
      listState={userReviews.listState}
      createState={userReviews.createState}
      archiveState={userReviews.archiveState}
      onTargetScopeChange={selectTargetScope}
      onWorkspaceModeChange={setWorkspaceMode}
      onCreateUserReview={() => {
        const openCommentIds = comments
          .filter(Comment.isOpen)
          .map((comment) => comment.id);

        void userReviews.createUserReview({
          commentIds: openCommentIds,
          workspaceMode,
        });
      }}
      onArchiveUserReview={(userReviewId) => {
        void userReviews.archiveUserReview(userReviewId);
      }}
      onRefreshUserReviews={() => {
        void userReviews.reloadUserReviews();
      }}
      onCopyPath={copyTextToClipboard}
    />
  );
}

/** @returns The number of unresolved comments in the active sidebar list. */
function countOpenComments(
  comments: readonly UserReviewCommentSummary[],
): number {
  return comments.filter(Comment.isOpen).length;
}
