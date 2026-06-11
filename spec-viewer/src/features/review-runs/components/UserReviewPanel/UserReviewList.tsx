import { formatProblemState } from "@/features/review-runs/components/userReviewPanelPresenter";
import type { UserReview } from "@/features/review-runs/domain/userReview";
import type {
  UserReviewArchiveState,
  UserReviewListState,
} from "@/features/review-runs/hooks/useUserReviews";

import { UserReviewCard } from "./UserReviewCard";

type Props = Readonly<{
  listState: UserReviewListState;
  activeReviews: readonly UserReview[];
  archiveState: UserReviewArchiveState;
  onCopyPath: (path: string) => void;
  onArchiveUserReview: (userReviewId: string) => void;
}>;

/** @returns Active review run cards or a loading/empty/error state. */
export function UserReviewList({
  listState,
  activeReviews,
  archiveState,
  onCopyPath,
  onArchiveUserReview,
}: Props) {
  if (listState.status === "idle") {
    return (
      <p className="review-run-panel__empty">
        Specファイルを選択するとレビュー作成を開始できます。
      </p>
    );
  }

  if (listState.status === "loading") {
    return (
      <p className="review-run-panel__empty" role="status">
        レビュー一覧を読み込んでいます。
      </p>
    );
  }

  if (listState.status === "error") {
    return (
      <p
        className="review-run-panel__feedback review-run-panel__feedback--error"
        role="alert"
      >
        レビュー一覧を読み込めませんでした。{listState.error.message}
      </p>
    );
  }

  if (activeReviews.length === 0) {
    return (
      <div className="review-run-panel__runs" aria-label="アクティブレビュー">
        <UserReviewProblems problems={listState.problems} />
        <p className="review-run-panel__empty">
          アクティブなレビューはありません。
        </p>
      </div>
    );
  }

  return (
    <div className="review-run-panel__runs" aria-label="アクティブレビュー">
      <UserReviewProblems problems={listState.problems} />
      {activeReviews.map((run) => (
        <UserReviewCard
          key={run.id}
          run={run}
          archiveState={archiveState}
          onCopyPath={onCopyPath}
          onArchiveUserReview={onArchiveUserReview}
        />
      ))}
    </div>
  );
}

type UserReviewProblemsProps = Readonly<{
  problems: UserReviewListState["problems"];
}>;

/** @returns Malformed or missing review run folders that need manual attention. */
function UserReviewProblems({ problems }: UserReviewProblemsProps) {
  if (problems.length === 0) {
    return null;
  }

  return (
    <div className="review-run-panel__problems" role="alert">
      {problems.map((problem) => (
        <p key={`${problem.state}:${problem.folderPath}`}>
          {formatProblemState(problem.state)}: {problem.message}
        </p>
      ))}
    </div>
  );
}
