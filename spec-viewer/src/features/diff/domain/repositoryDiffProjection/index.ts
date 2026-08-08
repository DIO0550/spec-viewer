import type {
  ContentClassification,
  EntryKind,
  FileChange,
  FileChangeStatus,
  StructuredDiff,
} from "@/features/diff/domain/fileDiff";
import type { RepositoryTreeNode } from "@/features/diff/domain/repositoryDiff";

/** Null means the structured diff was omitted, so the counts are unknown. */
export type LineChangeCounts = Readonly<{
  additions: number;
  deletions: number;
}> | null;

/**
 * Counts added and removed lines, which the backend does not report.
 *
 * @param structuredDiff - Structured diff returned by load_repository_file.
 * @returns Added and removed line counts, or null when the diff was omitted.
 */
export function countLineChanges(
  structuredDiff: StructuredDiff,
): LineChangeCounts {
  if (structuredDiff.state === "omitted") {
    return null;
  }

  let additions = 0;
  let deletions = 0;
  for (const hunk of structuredDiff.hunks) {
    for (const line of hunk.lines) {
      additions += line.kind === "added" ? 1 : 0;
      deletions += line.kind === "removed" ? 1 : 0;
    }
  }

  return { additions, deletions };
}

/** The minimum a UI needs to render one changed entry. */
export type RepositoryChangeEntry = Readonly<{
  /** Stable UI identity, encoded so path separators cannot collide. */
  id: string;
  path: string;
  oldPath: string | null;
  newPath: string | null;
  change: FileChangeStatus;
  entryKind: EntryKind;
  contentClassification: ContentClassification;
  isBinary: boolean;
  similarity: number | null;
}>;

/**
 * Projects changed files into detached UI entries, preserving backend order.
 *
 * @param changed - `overview.changed` in backend order.
 * @returns Detached projection entries; the input array is never mutated.
 */
export function projectChangedEntries(
  changed: readonly FileChange[],
): readonly RepositoryChangeEntry[] {
  return changed.map((file) => {
    const path = file.newPath ?? file.oldPath ?? "";

    return {
      id: encodeURIComponent(path),
      path,
      oldPath: file.oldPath,
      newPath: file.newPath,
      change: file.change,
      entryKind: file.entryKind,
      contentClassification: file.contentClassification,
      isBinary: file.contentClassification === "binary",
      similarity: file.similarity,
    };
  });
}

/**
 * Display class of a tree node, keeping ignored distinct from untracked and
 * unchanged. This is an orthogonal axis, not a mapping of `FileChangeStatus`,
 * so it deliberately carries no label, badge or colour.
 */
export type RepositoryTreeEntryClass =
  | "ignored"
  | "untracked"
  | "changed"
  | "unchanged";

/**
 * @param node - Tree node from changedTree, allRoot or an ignored page.
 * @returns The display class; `ignored` always wins over the file status axis.
 */
export function classifyTreeEntry(
  node: RepositoryTreeNode,
): RepositoryTreeEntryClass {
  if (node.ignored) {
    return "ignored";
  }
  if (node.change === null) {
    return "unchanged";
  }
  if (node.change === "untracked") {
    return "untracked";
  }

  return "changed";
}
