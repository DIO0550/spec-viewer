import type { ReactElement } from "react";

import type { FileChangeStatus } from "@/features/diff/domain/fileDiff";
import { getFileChangePresentation } from "@/features/diff/lib/fileChangePresentation";

import type {
  RepositoryDiffFilter,
  RepositoryDiffSummary as RepositoryDiffSummaryModel,
} from "@/features/repositoryDiff/domain/repositoryDiff";

export type RepositoryDiffSummaryProps = Readonly<{
  summary: RepositoryDiffSummaryModel;
}>;

/** Displays the logical counts for the active repository Diff filter. */
export function RepositoryDiffSummary(
  props: RepositoryDiffSummaryProps,
): ReactElement {
  const { summary } = props;
  const statusEntries = Object.entries(summary.statusCounts).filter(
    (entry): entry is [FileChangeStatus, number] => entry[1] !== undefined,
  );

  return (
    <section className="repository-diff-summary" aria-label="差分サマリー">
      <div className="repository-diff-summary__headline">
        <span>{filterLabel(summary.filter)}</span>
        <strong>{summary.totalPaths} paths</strong>
      </div>
      <dl className="repository-diff-summary__counts">
        <div>
          <dt>変更</dt>
          <dd>{summary.changedPaths}</dd>
        </div>
        <div>
          <dt>無視ディレクトリ</dt>
          <dd>{summary.ignoredDirectoryCount}</dd>
        </div>
        {statusEntries.map(([status, count]) => (
          <div key={status}>
            <dt>{getFileChangePresentation(status).label}</dt>
            <dd>{count}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function filterLabel(filter: RepositoryDiffFilter): string {
  return filter === "changed" ? "変更ファイル" : "全ファイル";
}
