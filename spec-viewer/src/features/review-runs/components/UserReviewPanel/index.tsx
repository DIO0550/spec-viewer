import { FileText, Layers, RefreshCw, Sparkles } from "lucide-react";
import { useId, useState } from "react";

import {
  canCreateUserReview,
  formatOpenCommentSummary,
} from "@/features/review-runs/components/userReviewPanelPresenter";
import { PathCopyState } from "@/features/review-runs/domain/pathCopyState";
import type {
  UserReviewArchiveState,
  UserReviewCreateState,
  UserReviewListState,
  UserReviewTargetScope,
} from "@/features/review-runs/hooks/useUserReviews";
import type { UserReviewWorkspaceMode } from "@/features/review-runs/types/userReviewIpc";

import { UserReviewFeedback } from "./UserReviewFeedback";
import { UserReviewList } from "./UserReviewList";

type Props = Readonly<{
  targetScope: UserReviewTargetScope;
  workspaceMode: UserReviewWorkspaceMode;
  openCommentCount: number;
  listState: UserReviewListState;
  createState: UserReviewCreateState;
  archiveState: UserReviewArchiveState;
  /** @param scope - User review target scope selected in the panel */
  onTargetScopeChange: (scope: UserReviewTargetScope) => void;
  /** @param mode - Workspace mode selected in the panel */
  onWorkspaceModeChange: (mode: UserReviewWorkspaceMode) => void;
  /** Creates a user review for the current target. */
  onCreateUserReview: () => void;
  /** @param userReviewId - Identifier of the user review to archive */
  onArchiveUserReview: (userReviewId: string) => void;
  /** Reloads the user review list. */
  onRefreshUserReviews: () => void;
  /** @param path - Review run folder path to copy */
  onCopyPath: (path: string) => Promise<void>;
}>;

/** @returns Japanese-first controls and status for active user reviews. */
export function UserReviewPanel({
  targetScope,
  workspaceMode,
  openCommentCount,
  listState,
  createState,
  archiveState,
  onTargetScopeChange,
  onWorkspaceModeChange,
  onCreateUserReview,
  onArchiveUserReview,
  onRefreshUserReviews,
  onCopyPath,
}: Props) {
  const workspaceModeLabelId = useId();
  const [copyState, setCopyState] = useState<PathCopyState>(PathCopyState.idle);
  const isCreating = createState.status === "saving";
  const canCreate = canCreateUserReview({ openCommentCount, isCreating });
  const activeReviews = listState.active;

  const copyPath = async (path: string): Promise<void> => {
    try {
      await onCopyPath(path);
      setCopyState(PathCopyState.succeeded());
    } catch (error) {
      setCopyState(PathCopyState.failed(error));
    }
  };

  return (
    <section className="review-run-panel" aria-label="ユーザーレビュー">
      <header className="review-run-panel__header">
        <div>
          <h3>ユーザーレビュー</h3>
          <p>{formatOpenCommentSummary(openCommentCount)}</p>
        </div>
        <button
          className="icon-button"
          type="button"
          aria-label="レビュー一覧を再読み込み"
          disabled={listState.status === "loading"}
          onClick={onRefreshUserReviews}
        >
          <RefreshCw aria-hidden="true" size={15} />
        </button>
      </header>

      <section className="review-run-panel__target" aria-label="レビュー範囲">
        <button
          type="button"
          aria-pressed={targetScope === "file"}
          onClick={() => {
            onTargetScopeChange("file");
          }}
        >
          <FileText aria-hidden="true" size={14} />
          <span>ファイル</span>
        </button>
        <button
          type="button"
          aria-pressed={targetScope === "spec"}
          onClick={() => {
            onTargetScopeChange("spec");
          }}
        >
          <Layers aria-hidden="true" size={14} />
          <span>Spec</span>
        </button>
      </section>

      <fieldset
        className="review-run-panel__modes"
        aria-labelledby={workspaceModeLabelId}
      >
        <legend id={workspaceModeLabelId}>作成先</legend>
        <label>
          <input
            type="radio"
            name="user-review-workspace-mode"
            value="currentWorkspace"
            checked={workspaceMode === "currentWorkspace"}
            onChange={() => {
              onWorkspaceModeChange("currentWorkspace");
            }}
          />
          <span>現在のワークスペース</span>
        </label>
        <label>
          <input
            type="radio"
            name="user-review-workspace-mode"
            value="worktree"
            checked={workspaceMode === "worktree"}
            onChange={() => {
              onWorkspaceModeChange("worktree");
            }}
          />
          <span>新しいworktree</span>
        </label>
      </fieldset>

      <button
        className="button button--primary review-run-panel__create"
        type="button"
        disabled={!canCreate}
        onClick={onCreateUserReview}
      >
        <Sparkles aria-hidden="true" size={15} />
        <span>{isCreating ? "作成中" : "レビュー作成"}</span>
      </button>

      <UserReviewFeedback
        createState={createState}
        archiveState={archiveState}
        copyState={copyState}
      />
      <UserReviewList
        listState={listState}
        activeReviews={activeReviews}
        archiveState={archiveState}
        onCopyPath={(path) => {
          void copyPath(path);
        }}
        onArchiveUserReview={onArchiveUserReview}
      />
    </section>
  );
}
