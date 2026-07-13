import { Archive, FileText, Layers, RefreshCw, Sparkles } from "lucide-react";
import {
  formatArchiveErrorMessage,
  formatArchiveSuccessMessage,
  formatCreateErrorMessage,
  formatCreateSuccessMessage,
  formatOpenCommentSummary,
  formatUserReviewRecordProblem,
  formatUserReviewSummary,
} from "@/features/review-runs/components/userReviewPanelPresenter";
import type { ActiveUserReview } from "@/features/review-runs/domain/userReview";
import type { UserReviewRecordProblem } from "@/features/review-runs/domain/userReviewRecordProblem";
import type {
  UserReviewArchiveState,
  UserReviewCreateState,
  UserReviewListState,
  UserReviewTargetScope,
} from "@/features/review-runs/hooks/useUserReviews";

type Props = Readonly<{
  targetScope: UserReviewTargetScope;
  openCommentCount: number;
  canCreateUserReview: boolean;
  listState: UserReviewListState;
  createState: UserReviewCreateState;
  archiveState: UserReviewArchiveState;
  /** Changes the review target scope. @param scope - The new target scope. */
  onTargetScopeChange: (scope: UserReviewTargetScope) => void;
  /** Creates a new user review. */
  onCreateUserReview: () => void;
  /** Archives a user review. @param userReview - Aggregate to archive. */
  onArchiveUserReview: (userReview: ActiveUserReview) => void;
  /** Refreshes the user review list. */
  onRefreshUserReviews: () => void;
}>;

/**
 * @param props - Current target, operation states, and panel callbacks.
 * @returns Japanese-first controls and status for active user reviews.
 */
export function UserReviewPanel({
  targetScope,
  openCommentCount,
  listState,
  canCreateUserReview,
  createState,
  archiveState,
  onTargetScopeChange,
  onCreateUserReview,
  onArchiveUserReview,
  onRefreshUserReviews,
}: Props) {
  const isCreating = createState.status === "saving";
  const canCreate = canCreateUserReview && !isCreating;

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

      <fieldset className="review-run-panel__target" aria-label="レビュー範囲">
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
      />
      <UserReviewList
        listState={listState}
        archiveState={archiveState}
        onArchiveUserReview={onArchiveUserReview}
      />
    </section>
  );
}

type UserReviewFeedbackProps = Readonly<{
  createState: UserReviewCreateState;
  archiveState: UserReviewArchiveState;
}>;

/**
 * @param props - Current create and archive operation states.
 * @returns The latest user review operation feedback message.
 */
function UserReviewFeedback({
  createState,
  archiveState,
}: UserReviewFeedbackProps) {
  if (archiveState.status === "success") {
    return (
      <p
        className="review-run-panel__feedback review-run-panel__feedback--success"
        role="status"
      >
        {formatArchiveSuccessMessage(archiveState.result)}
      </p>
    );
  }

  if (archiveState.status === "error") {
    return (
      <p
        className="review-run-panel__feedback review-run-panel__feedback--error"
        role="alert"
      >
        {formatArchiveErrorMessage(archiveState.error.message)}
      </p>
    );
  }

  if (createState.status === "success") {
    return (
      <p
        className="review-run-panel__feedback review-run-panel__feedback--success"
        role="status"
      >
        {formatCreateSuccessMessage(createState.result)}
      </p>
    );
  }

  if (createState.status === "error") {
    return (
      <p
        className="review-run-panel__feedback review-run-panel__feedback--error"
        role="alert"
      >
        {formatCreateErrorMessage(createState.error.message)}
      </p>
    );
  }

  return null;
}

type UserReviewListProps = Readonly<{
  listState: UserReviewListState;
  archiveState: UserReviewArchiveState;
  /** Archives a user review. @param userReview - Aggregate to archive. */
  onArchiveUserReview: (userReview: ActiveUserReview) => void;
}>;

/**
 * @param props - Current list and archive state plus the archive callback.
 * @returns Active user review cards or a loading, empty, or error state.
 */
function UserReviewList({
  listState,
  archiveState,
  onArchiveUserReview,
}: UserReviewListProps) {
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

  if (listState.active.length === 0) {
    return (
      <section
        className="review-run-panel__runs"
        aria-label="アクティブレビュー"
      >
        <UserReviewProblems problems={listState.problems} />
        <p className="review-run-panel__empty">
          アクティブなレビューはありません。
        </p>
      </section>
    );
  }

  return (
    <section className="review-run-panel__runs" aria-label="アクティブレビュー">
      <UserReviewProblems problems={listState.problems} />
      {listState.active.map((review) => (
        <article className="review-run-panel__run" key={review.id}>
          <div className="review-run-panel__run-header">
            <div>
              <h4>{review.id}</h4>
              <p>{formatUserReviewSummary(review)}</p>
            </div>
          </div>
          <code className="review-run-panel__path">{review.recordLocator}</code>
          <UserReviewActions
            review={review}
            archiveState={archiveState}
            onArchiveUserReview={onArchiveUserReview}
          />
        </article>
      ))}
    </section>
  );
}

type UserReviewProblemsProps = Readonly<{
  problems: readonly UserReviewRecordProblem[];
}>;

/**
 * @param props - Typed record problems returned with the review list.
 * @returns Records that need user attention.
 */
function UserReviewProblems({ problems }: UserReviewProblemsProps) {
  if (problems.length === 0) {
    return null;
  }

  return (
    <div className="review-run-panel__problems" role="alert">
      {problems.map((problem) => (
        <UserReviewProblem
          key={`${problem.kind}:${problem.locator}`}
          problem={problem}
        />
      ))}
    </div>
  );
}

type UserReviewProblemProps = Readonly<{
  problem: UserReviewRecordProblem;
}>;

/**
 * @param props - One typed record problem.
 * @returns Locator plus a user-facing label and description.
 */
function UserReviewProblem({ problem }: UserReviewProblemProps) {
  const presentation = formatUserReviewRecordProblem(problem.kind);

  return (
    <p>
      <strong>
        {presentation.label}: {problem.locator}
      </strong>{" "}
      <span>{presentation.description}</span>
    </p>
  );
}

type UserReviewActionsProps = Readonly<{
  review: ActiveUserReview;
  archiveState: UserReviewArchiveState;
  /** Archives a user review. @param userReview - Aggregate to archive. */
  onArchiveUserReview: (userReview: ActiveUserReview) => void;
}>;

/**
 * @param props - Review aggregate, archive state, and archive callback.
 * @returns Lifecycle actions derived from the review aggregate.
 */
function UserReviewActions({
  review,
  archiveState,
  onArchiveUserReview,
}: UserReviewActionsProps) {
  const isSaving = archiveState.status === "saving";

  return (
    <div className="review-run-panel__actions">
      <button
        className="button button--secondary"
        type="button"
        aria-label={`${review.id}をアーカイブ`}
        disabled={isSaving}
        title="アクティブなレビューをアーカイブ"
        onClick={() => {
          if (confirmArchiveUserReview(review)) {
            onArchiveUserReview(review);
          }
        }}
      >
        <Archive aria-hidden="true" size={14} />
        <span>{isSaving ? "アーカイブ中" : "アーカイブ"}</span>
      </button>
    </div>
  );
}

/**
 * @param review - The user review to be archived.
 * @returns True when the user confirms the active-to-archived transition.
 */
function confirmArchiveUserReview(review: ActiveUserReview): boolean {
  return window.confirm(
    `レビュー ${review.id} をアーカイブします。この操作は元に戻せません。`,
  );
}
