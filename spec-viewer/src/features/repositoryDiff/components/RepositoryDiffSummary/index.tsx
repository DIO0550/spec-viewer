import type { ReactElement } from "react";

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
    (entry): entry is [string, number] => entry[1] !== undefined,
  );

  return (
    <section
      className="repository-diff-summary"
      aria-label="Repository diff summary"
    >
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
            <dt>{getStatusLabel(status)}</dt>
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

function getStatusLabel(status: string): string {
  if (status === "added") {
    return "追加";
  }
  if (status === "modified") {
    return "変更";
  }
  if (status === "deleted") {
    return "削除";
  }
  if (status === "renamed") {
    return "名前変更";
  }
  if (status === "copied") {
    return "コピー";
  }
  if (status === "typeChanged") {
    return "種別変更";
  }
  if (status === "untracked") {
    return "未追跡";
  }
  return status;
}
