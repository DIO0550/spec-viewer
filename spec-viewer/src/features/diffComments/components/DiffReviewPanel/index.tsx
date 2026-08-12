import { type ReactElement, useMemo } from "react";

import type { UseDiffCommentsResult } from "@/features/diffComments";
import { DiffReviewSidebar } from "@/features/diffComments/components/DiffReviewSidebar";
import { toDiffReviewComments } from "@/features/diffComments/components/presentation";

export type DiffReviewPanelProps = Readonly<{
  state: UseDiffCommentsResult;
  onJump: (commentId: string) => void;
}>;

/** Renders worktree-wide Diff Review state without exposing persistence DTOs. */
export function DiffReviewPanel(props: DiffReviewPanelProps): ReactElement {
  const session = props.state.session;
  const reviewComments = useMemo(
    () => toDiffReviewComments(session?.comments ?? []),
    [session?.comments],
  );
  const mutatingCommentId =
    session?.mutation.state === "saving"
      ? (session.selectedCommentId ?? session.draft?.commentId ?? null)
      : null;
  const mutationDisabledReason = session?.writeBlockReason ?? null;
  const durabilityWarnings =
    session?.mutation.state === "committed" &&
    session.mutation.durability === "uncertain"
      ? [
          "保存は完了しましたが永続化の確認が不確実です。再読み込みして確認してください。",
        ]
      : [];

  return (
    <DiffReviewSidebar
      comments={reviewComments}
      filter={session?.filter ?? "all"}
      search={session?.search ?? ""}
      selectedCommentId={session?.selectedCommentId ?? null}
      loadState={session?.loadState ?? "idle"}
      warnings={[
        ...(session?.resolutionWarnings ?? []).map(
          (warning) => warning.message,
        ),
        ...durabilityWarnings,
      ]}
      onFilterChange={props.state.setFilter}
      onSearchChange={props.state.setSearch}
      onReload={() => {
        void props.state.reload();
      }}
      onSelectComment={props.state.selectComment}
      onJump={props.onJump}
      onUpdate={(commentId, body) => {
        props.state.selectComment(commentId);
        return props.state.updateComment({ commentId, body });
      }}
      mutatingCommentId={mutatingCommentId}
      mutationDisabledReason={mutationDisabledReason}
      onResolve={(commentId) => {
        props.state.selectComment(commentId);
        void props.state.updateComment({ commentId, resolved: true });
      }}
      onReopen={(commentId) => {
        props.state.selectComment(commentId);
        void props.state.updateComment({ commentId, resolved: false });
      }}
    />
  );
}
