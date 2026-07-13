import {
  Archive,
  Clipboard,
  Copy,
  FileText,
  GitBranch,
  Layers,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { useId, useState } from "react";
import {
  canArchiveUserReview,
  canCreateUserReview,
  formatArchiveErrorMessage,
  formatArchiveSuccessMessage,
  formatCreateErrorMessage,
  formatCreateSuccessMessage,
  formatOpenCommentSummary,
  formatProblemState,
  formatUserReviewSummary,
} from "@/features/review-runs/components/userReviewPanelPresenter";
import type { UserReviewId } from "@/features/review-runs/domain/userReviewId";
import type {
  ReviewSourceFile,
  UserReview,
  UserReviewWorkspace,
} from "@/features/review-runs/domain/userReview";
import type {
  UserReviewArchiveState,
  UserReviewCreateState,
  UserReviewListState,
  UserReviewTargetScope,
} from "@/features/review-runs/hooks/useUserReviews";
import type { UserReviewWorkspaceMode } from "@/features/review-runs/types/userReviewIpc";

type Props = Readonly<{
  targetScope: UserReviewTargetScope;
  workspaceMode: UserReviewWorkspaceMode;
  openCommentCount: number;
  listState: UserReviewListState;
  createState: UserReviewCreateState;
  archiveState: UserReviewArchiveState;
  /** Changes the review target scope. @param scope - The new target scope. */
  onTargetScopeChange: (scope: UserReviewTargetScope) => void;
  /** Changes the workspace mode. @param mode - The new workspace mode. */
  onWorkspaceModeChange: (mode: UserReviewWorkspaceMode) => void;
  /** Creates a new user review. */
  onCreateUserReview: () => void;
  /** Archives a user review. @param userReviewId - ID of the review to archive. */
  onArchiveUserReview: (userReviewId: UserReviewId) => void;
  /** Refreshes the user review list. */
  onRefreshUserReviews: () => void;
  /** Copies a folder path. @param path - The path to copy to the clipboard. */
  onCopyPath: (path: string) => Promise<void>;
}>;

type CopyState =
  | Readonly<{
      status: "idle";
      message: null;
    }>
  | Readonly<{
      status: "success" | "error";
      message: string;
    }>;

const idleCopyState: CopyState = {
  status: "idle",
  message: null,
};

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
  const [copyState, setCopyState] = useState<CopyState>(idleCopyState);
  const isCreating = createState.status === "saving";
  const canCreate = canCreateUserReview({ openCommentCount, isCreating });
  const activeReviews = listState.active;

  const copyPath = async (path: string): Promise<void> => {
    try {
      await onCopyPath(path);
      setCopyState({
        status: "success",
        message: "フォルダパスをコピーしました。",
      });
    } catch (error) {
      setCopyState({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "フォルダパスをコピーできませんでした。",
      });
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

      <div className="review-run-panel__target" aria-label="レビュー範囲">
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
      </div>

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

type UserReviewFeedbackProps = Readonly<{
  createState: UserReviewCreateState;
  archiveState: UserReviewArchiveState;
  copyState: CopyState;
}>;

/** @returns The latest create/copy feedback message. */
function UserReviewFeedback({
  createState,
  archiveState,
  copyState,
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

  if (copyState.status === "idle") {
    return null;
  }

  return (
    <p
      className={`review-run-panel__feedback review-run-panel__feedback--${copyState.status}`}
      role={copyState.status === "error" ? "alert" : "status"}
    >
      {copyState.message}
    </p>
  );
}

type UserReviewListProps = Readonly<{
  listState: UserReviewListState;
  activeReviews: readonly UserReview[];
  archiveState: UserReviewArchiveState;
  /** Copies a folder path. @param path - The path to copy to the clipboard. */
  onCopyPath: (path: string) => void;
  /** Archives a user review. @param userReviewId - ID of the review to archive. */
  onArchiveUserReview: (userReviewId: UserReviewId) => void;
}>;

/** @returns Active review run cards or a loading/empty/error state. */
function UserReviewList({
  listState,
  activeReviews,
  archiveState,
  onCopyPath,
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
        <article className="review-run-panel__run" key={run.id}>
          <div className="review-run-panel__run-header">
            <div>
              <h4>{run.id}</h4>
              <p>{formatUserReviewSummary(run)}</p>
            </div>
            <button
              className="icon-button"
              type="button"
              aria-label={`${run.id}のフォルダパスをコピー`}
              onClick={() => {
                onCopyPath(run.folderPath);
              }}
            >
              <Copy aria-hidden="true" size={14} />
            </button>
          </div>
          <UserReviewSummary run={run} />
          <code className="review-run-panel__path">{run.folderPath}</code>
          <SourceFileSummary sourceFiles={run.sourceFiles} />
          <WorkspaceSummary workspace={run.workspace} />
          <UserReviewActions
            run={run}
            archiveState={archiveState}
            onArchiveUserReview={onArchiveUserReview}
          />
        </article>
      ))}
    </div>
  );
}

type UserReviewProblemsProps = Readonly<{
  problems: UserReviewListState["problems"];
}>;

/**
 * @param props - Component props.
 * @param props.problems - Malformed or missing review run folder problems.
 * @returns Malformed or missing review run folders that need manual attention.
 */
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

type UserReviewSummaryProps = Readonly<{
  run: UserReview;
}>;

/**
 * @param props - Component props.
 * @param props.run - The user review to summarize.
 * @returns Result summary and warnings captured from status/result files.
 */
function UserReviewSummary({ run }: UserReviewSummaryProps) {
  if (run.summary === null && run.warnings.length === 0) {
    return null;
  }

  return (
    <div className="review-run-panel__result">
      {run.summary !== null ? <p>{run.summary}</p> : null}
      {run.warnings.length > 0 ? (
        <ul>
          {run.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

type UserReviewActionsProps = Readonly<{
  run: UserReview;
  archiveState: UserReviewArchiveState;
  /** Archives a user review. @param userReviewId - ID of the review to archive. */
  onArchiveUserReview: (userReviewId: UserReviewId) => void;
}>;

/** @returns User review lifecycle actions. */
function UserReviewActions({
  run,
  archiveState,
  onArchiveUserReview,
}: UserReviewActionsProps) {
  const isSaving =
    archiveState.status === "saving" &&
    archiveState.payload.userReviewId === run.id;
  const canArchive = canArchiveUserReview(run, isSaving);

  return (
    <div className="review-run-panel__actions">
      <button
        className="button button--secondary"
        type="button"
        aria-label={`${run.id}をアーカイブ`}
        disabled={!canArchive}
        title={
          run.status === "completed"
            ? "完了済みレビューをアーカイブ"
            : "status.jsonがcompletedのレビューだけアーカイブできます"
        }
        onClick={() => {
          if (confirmArchiveUserReview(run)) {
            onArchiveUserReview(run.id);
          }
        }}
      >
        <Archive aria-hidden="true" size={14} />
        <span>{isSaving ? "アーカイブ中" : "アーカイブ"}</span>
      </button>
    </div>
  );
}

type SourceFileSummaryProps = Readonly<{
  sourceFiles: readonly ReviewSourceFile[];
}>;

/**
 * @param props - Component props.
 * @param props.sourceFiles - Source files included in the review bundle.
 * @returns A compact source file list for the review bundle.
 */
function SourceFileSummary({ sourceFiles }: SourceFileSummaryProps) {
  return (
    <ul className="review-run-panel__source-files" aria-label="対象ファイル">
      {sourceFiles.map((file) => (
        <li key={`${file.specId}:${file.fileKey}`}>
          <FileText aria-hidden="true" size={13} />
          <span>{file.relativePath}</span>
        </li>
      ))}
    </ul>
  );
}

type WorkspaceSummaryProps = Readonly<{
  workspace: UserReviewWorkspace;
}>;

/**
 * @param props - Component props.
 * @param props.workspace - The workspace metadata for the review.
 * @returns Worktree metadata when the review uses an isolated checkout.
 */
function WorkspaceSummary({ workspace }: WorkspaceSummaryProps) {
  if (workspace.mode === "currentWorkspace") {
    return null;
  }

  return (
    <dl className="review-run-panel__worktree">
      <div>
        <dt>
          <GitBranch aria-hidden="true" size={13} />
          <span>Branch</span>
        </dt>
        <dd>{workspace.branchName}</dd>
      </div>
      <div>
        <dt>
          <Clipboard aria-hidden="true" size={13} />
          <span>Worktree</span>
        </dt>
        <dd>{workspace.worktreePath}</dd>
      </div>
    </dl>
  );
}

/**
 * @param run - The user review to be archived.
 * @returns True when the user confirms the irreversible active-to-archive move.
 */
function confirmArchiveUserReview(run: UserReview): boolean {
  return window.confirm(
    `完了済みレビュー ${run.id} をアーカイブします。activeフォルダからarchiveフォルダへ移動します。`,
  );
}
