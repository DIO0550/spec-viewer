import { Archive, Clipboard, Copy, FileText, GitBranch } from "lucide-react";

import {
  canArchiveUserReview,
  formatUserReviewSummary,
} from "@/features/review-runs/components/userReviewPanelPresenter";
import type {
  ReviewSourceFile,
  UserReview,
  UserReviewWorkspace,
} from "@/features/review-runs/domain/userReview";
import type { UserReviewArchiveState } from "@/features/review-runs/hooks/useUserReviews";

type Props = Readonly<{
  run: UserReview;
  archiveState: UserReviewArchiveState;
  onCopyPath: (path: string) => void;
  onArchiveUserReview: (userReviewId: string) => void;
}>;

/** @returns One active review run card with its summary and actions. */
export function UserReviewCard({
  run,
  archiveState,
  onCopyPath,
  onArchiveUserReview,
}: Props) {
  return (
    <article className="review-run-panel__run">
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
  );
}

type UserReviewSummaryProps = Readonly<{
  run: UserReview;
}>;

/** @returns Result summary and warnings captured from status/result files. */
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
  onArchiveUserReview: (userReviewId: string) => void;
}>;

/** @returns User review lifecycle actions. */
function UserReviewActions({
  run,
  archiveState,
  onArchiveUserReview,
}: UserReviewActionsProps) {
  const isSaving =
    archiveState.status === "saving" && archiveState.userReviewId === run.id;
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

type WorkspaceSummaryProps = Readonly<{
  workspace: UserReviewWorkspace;
}>;

/** @returns Worktree metadata when the review uses an isolated checkout. */
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
 * @param run - Completed review run to archive
 * @returns True when the user confirms the irreversible active-to-archive move.
 */
function confirmArchiveUserReview(run: UserReview): boolean {
  return window.confirm(
    `完了済みレビュー ${run.id} をアーカイブします。activeフォルダからarchiveフォルダへ移動します。`,
  );
}
