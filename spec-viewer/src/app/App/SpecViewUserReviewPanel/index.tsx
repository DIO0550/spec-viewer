import type { ReactElement } from "react";
import { useSpecViewSelection } from "@/app/context/specViewSelection";
import type { Comment, CommentId } from "@/features/comments";
import { UserReviewPanel, useUserReviews } from "@/features/review-runs";

type UserReviewCommentSummary = Readonly<{
  id: CommentId;
  status: Comment["status"];
}>;

export type SpecViewUserReviewPanelProps = Readonly<{
  comments: readonly UserReviewCommentSummary[];
  correlationId: string | null;
}>;

/**
 * @param props - Comment summaries, document correlation id and reset keys.
 * @returns User review panel wired to the app-level spec view selection.
 */
export function SpecViewUserReviewPanel(
  props: SpecViewUserReviewPanelProps,
): ReactElement {
  const { comments, correlationId } = props;
  const { selection, setTargetScope, selectionId } = useSpecViewSelection();
  const userReviews = useUserReviews({
    selectionSnapshot: {
      selection,
      selectionId,
    },
    correlationId,
  });
  const openCommentIds = getOpenCommentIds(comments);

  return (
    <UserReviewPanel
      targetScope={selection.targetScope}
      openCommentCount={openCommentIds.length}
      canCreateUserReview={userReviews.canCreateUserReview({
        commentIds: openCommentIds,
      })}
      listState={userReviews.listState}
      createState={userReviews.createState}
      archiveState={userReviews.archiveState}
      onTargetScopeChange={setTargetScope}
      onCreateUserReview={() => {
        void userReviews.createUserReview({
          commentIds: openCommentIds,
        });
      }}
      onArchiveUserReview={(userReview) => {
        void userReviews.archiveUserReview(userReview);
      }}
      onRefreshUserReviews={() => {
        void userReviews.reloadUserReviews();
      }}
    />
  );
}

/**
 * @param comments - Comment summaries visible in the active sidebar.
 * @returns IDs of unresolved comments in the active sidebar list.
 */
function getOpenCommentIds(
  comments: readonly UserReviewCommentSummary[],
): readonly CommentId[] {
  return comments
    .filter((comment) => comment.status === "open")
    .map((comment) => comment.id);
}
