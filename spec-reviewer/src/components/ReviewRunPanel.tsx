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

import type {
  ReviewRunCreateState,
  ReviewRunArchiveState,
  ReviewRunListState,
  ReviewRunTargetScope,
} from "../hooks/useReviewRuns";
import type {
  ReviewRun,
  ReviewRunExecutionMode,
  ReviewRunExecutionTarget,
  ReviewRunSourceFile,
} from "../types/reviewRun";

type Props = Readonly<{
  targetScope: ReviewRunTargetScope;
  executionMode: ReviewRunExecutionMode;
  openCommentCount: number;
  listState: ReviewRunListState;
  createState: ReviewRunCreateState;
  archiveState: ReviewRunArchiveState;
  onTargetScopeChange: (scope: ReviewRunTargetScope) => void;
  onExecutionModeChange: (mode: ReviewRunExecutionMode) => void;
  onCreateReviewRun: () => void;
  onArchiveReviewRun: (reviewRunId: string) => void;
  onRefreshReviewRuns: () => void;
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

const reviewRunStatusLabels: Readonly<Record<ReviewRun["status"], string>> = {
  active: "受付中",
  inProgress: "対応中",
  completed: "完了",
  archived: "アーカイブ済み",
};

/** @returns Japanese-first controls and status for active review runs. */
export function ReviewRunPanel({
  targetScope,
  executionMode,
  openCommentCount,
  listState,
  createState,
  archiveState,
  onTargetScopeChange,
  onExecutionModeChange,
  onCreateReviewRun,
  onArchiveReviewRun,
  onRefreshReviewRuns,
  onCopyPath,
}: Props) {
  const executionModeLabelId = useId();
  const [copyState, setCopyState] = useState<CopyState>(idleCopyState);
  const isCreating = createState.status === "saving";
  const canCreate = openCommentCount > 0 && !isCreating;
  const activeRuns = listState.active;

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
          onClick={onRefreshReviewRuns}
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
        aria-labelledby={executionModeLabelId}
      >
        <legend id={executionModeLabelId}>作成先</legend>
        <label>
          <input
            type="radio"
            name="review-run-execution-mode"
            value="currentWorkspace"
            checked={executionMode === "currentWorkspace"}
            onChange={() => {
              onExecutionModeChange("currentWorkspace");
            }}
          />
          <span>現在のワークスペース</span>
        </label>
        <label>
          <input
            type="radio"
            name="review-run-execution-mode"
            value="worktree"
            checked={executionMode === "worktree"}
            onChange={() => {
              onExecutionModeChange("worktree");
            }}
          />
          <span>新しいworktree</span>
        </label>
      </fieldset>

      <button
        className="button button--primary review-run-panel__create"
        type="button"
        disabled={!canCreate}
        onClick={onCreateReviewRun}
      >
        <Sparkles aria-hidden="true" size={15} />
        <span>{isCreating ? "作成中" : "レビュー作成"}</span>
      </button>

      <ReviewRunFeedback
        createState={createState}
        archiveState={archiveState}
        copyState={copyState}
      />
      <ReviewRunList
        listState={listState}
        activeRuns={activeRuns}
        archiveState={archiveState}
        onCopyPath={(path) => {
          void copyPath(path);
        }}
        onArchiveReviewRun={onArchiveReviewRun}
      />
    </section>
  );
}

type ReviewRunFeedbackProps = Readonly<{
  createState: ReviewRunCreateState;
  archiveState: ReviewRunArchiveState;
  copyState: CopyState;
}>;

/** @returns The latest create/copy feedback message. */
function ReviewRunFeedback({
  createState,
  archiveState,
  copyState,
}: ReviewRunFeedbackProps) {
  if (archiveState.status === "success") {
    return (
      <p
        className="review-run-panel__feedback review-run-panel__feedback--success"
        role="status"
      >
        {formatArchiveSuccessMessage(archiveState.reviewRun)}
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
        {formatCreateSuccessMessage(createState.reviewRun)}
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

type ReviewRunListProps = Readonly<{
  listState: ReviewRunListState;
  activeRuns: readonly ReviewRun[];
  archiveState: ReviewRunArchiveState;
  onCopyPath: (path: string) => void;
  onArchiveReviewRun: (reviewRunId: string) => void;
}>;

/** @returns Active review run cards or a loading/empty/error state. */
function ReviewRunList({
  listState,
  activeRuns,
  archiveState,
  onCopyPath,
  onArchiveReviewRun,
}: ReviewRunListProps) {
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

  if (activeRuns.length === 0) {
    return (
      <div className="review-run-panel__runs" aria-label="アクティブレビュー">
        <ReviewRunProblems problems={listState.problems} />
        <p className="review-run-panel__empty">
          アクティブなレビューはありません。
        </p>
      </div>
    );
  }

  return (
    <div className="review-run-panel__runs" aria-label="アクティブレビュー">
      <ReviewRunProblems problems={listState.problems} />
      {activeRuns.map((run) => (
        <article className="review-run-panel__run" key={run.id}>
          <div className="review-run-panel__run-header">
            <div>
              <h4>{run.id}</h4>
              <p>{formatRunSummary(run)}</p>
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
          <ReviewRunSummary run={run} />
          <code className="review-run-panel__path">{run.folderPath}</code>
          <SourceFileSummary sourceFiles={run.sourceFiles} />
          <ExecutionTargetSummary executionTarget={run.executionTarget} />
          <ReviewRunActions
            run={run}
            archiveState={archiveState}
            onArchiveReviewRun={onArchiveReviewRun}
          />
        </article>
      ))}
    </div>
  );
}

type ReviewRunProblemsProps = Readonly<{
  problems: ReviewRunListState["problems"];
}>;

/** @returns Malformed or missing review run folders that need manual attention. */
function ReviewRunProblems({ problems }: ReviewRunProblemsProps) {
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

type ReviewRunSummaryProps = Readonly<{
  run: ReviewRun;
}>;

/** @returns Result summary and warnings captured from status/result files. */
function ReviewRunSummary({ run }: ReviewRunSummaryProps) {
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

type ReviewRunActionsProps = Readonly<{
  run: ReviewRun;
  archiveState: ReviewRunArchiveState;
  onArchiveReviewRun: (reviewRunId: string) => void;
}>;

/** @returns Review run lifecycle actions. */
function ReviewRunActions({
  run,
  archiveState,
  onArchiveReviewRun,
}: ReviewRunActionsProps) {
  const isSaving =
    archiveState.status === "saving" && archiveState.reviewRunId === run.id;
  const canArchive = run.status === "completed" && !isSaving;

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
          if (confirmArchiveReviewRun(run)) {
            onArchiveReviewRun(run.id);
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
  sourceFiles: readonly ReviewRunSourceFile[];
}>;

/** @returns A compact source file list for the review bundle. */
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

type ExecutionTargetSummaryProps = Readonly<{
  executionTarget: ReviewRunExecutionTarget;
}>;

/** @returns Worktree metadata when the run uses an isolated checkout. */
function ExecutionTargetSummary({
  executionTarget,
}: ExecutionTargetSummaryProps) {
  if (executionTarget.mode === "currentWorkspace") {
    return null;
  }

  return (
    <dl className="review-run-panel__worktree">
      <div>
        <dt>
          <GitBranch aria-hidden="true" size={13} />
          <span>Branch</span>
        </dt>
        <dd>{executionTarget.branchName}</dd>
      </div>
      <div>
        <dt>
          <Clipboard aria-hidden="true" size={13} />
          <span>Worktree</span>
        </dt>
        <dd>{executionTarget.worktreePath}</dd>
      </div>
    </dl>
  );
}

/** @returns A Japanese summary for open comments included in a new run. */
function formatOpenCommentSummary(openCommentCount: number): string {
  if (openCommentCount === 0) {
    return "未解決コメントはありません。";
  }

  return `未解決コメント ${openCommentCount}件を対象にできます。`;
}

/** @returns A Japanese success message for a newly created run. */
function formatCreateSuccessMessage(reviewRun: ReviewRun): string {
  return `レビューを作成しました。${reviewRun.commentCount}件 / ${reviewRun.folderPath}`;
}

/** @returns A Japanese error message for review run creation failures. */
function formatCreateErrorMessage(message: string): string {
  return `レビューを作成できませんでした。${message}`;
}

/** @returns A Japanese success message for an archived run. */
function formatArchiveSuccessMessage(reviewRun: ReviewRun): string {
  return `レビューをアーカイブしました。${reviewRun.folderPath}`;
}

/** @returns A Japanese error message for archive failures. */
function formatArchiveErrorMessage(message: string): string {
  return `レビューをアーカイブできませんでした。${message}`;
}

/** @returns A compact status and comment summary for an active run. */
function formatRunSummary(run: ReviewRun): string {
  return `${reviewRunStatusLabels[run.status]} / コメント ${run.commentCount}件`;
}

/** @returns True when the user confirms the irreversible active-to-archive move. */
function confirmArchiveReviewRun(run: ReviewRun): boolean {
  return window.confirm(
    `完了済みレビュー ${run.id} をアーカイブします。activeフォルダからarchiveフォルダへ移動します。`,
  );
}

/** @returns A short Japanese label for malformed/missing folder list states. */
function formatProblemState(
  state: ReviewRunListState["problems"][number]["state"],
): string {
  if (state === "missingFolder") {
    return "フォルダなし";
  }

  return "壊れたレビュー";
}
