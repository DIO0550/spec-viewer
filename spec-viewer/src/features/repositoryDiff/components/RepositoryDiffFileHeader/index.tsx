import type { ReactElement } from "react";

import type { FileChangeStatus } from "@/features/diff/domain/fileDiff";
import { getFileChangePresentation } from "@/features/diff/lib/fileChangePresentation";
import type { DiffLineSummary } from "@/features/repositoryDiff/lib/repositoryDiffFilePresentation";

export type RepositoryDiffFileHeaderProps = Readonly<{
  path: string;
  change: FileChangeStatus | null;
  baseIdentifier: string;
  currentIdentifier: string;
  summary: DiffLineSummary | null;
}>;

/**
 * Displays repository-specific context above a source-neutral file viewer.
 *
 * @param props - Path, change, revisions, and optional line totals.
 * @returns The comparison header.
 */
export function RepositoryDiffFileHeader(
  props: RepositoryDiffFileHeaderProps,
): ReactElement {
  const status = getFileChangePresentation(props.change);

  return (
    <header
      className="repository-diff-file-header"
      aria-label={`${props.path} の比較情報`}
    >
      <strong className="repository-diff-file-header__path" title={props.path}>
        {props.path}
      </strong>
      <span
        className="repository-diff-file-header__status"
        data-change={props.change ?? "unchanged"}
      >
        {status.token} {status.label}
      </span>
      <span className="repository-diff-file-header__revision">
        base {props.baseIdentifier}
      </span>
      <span className="repository-diff-file-header__revision">
        current {props.currentIdentifier}
      </span>
      {props.summary === null ? null : (
        <span className="repository-diff-file-header__summary">
          <strong>+{props.summary.additions}</strong>{" "}
          <strong>-{props.summary.deletions}</strong>
        </span>
      )}
    </header>
  );
}
