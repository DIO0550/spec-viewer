import type { FileDiff } from "@/features/diff/domain/fileDiff";
import type {
  RepositoryDiffFile,
  RepositoryDiffOverview,
  RepositoryDiffTreeProjectionNode,
} from "@/features/repositoryDiff/domain/repositoryDiff";

export type DiffLineSummary = Readonly<{
  additions: number;
  deletions: number;
}>;

const GitObjectPattern = /^[0-9a-f]{40,64}$/i;
const SnapshotPattern = /^rs1_([0-9a-f]{64})$/i;

/**
 * Resolves the current logical path of a changed repository file.
 *
 * @param file - Repository file metadata.
 * @returns New path when present, otherwise old path.
 */
export function getRepositoryDiffLogicalPath(
  file: RepositoryDiffFile,
): string | null {
  return file.newPath ?? file.oldPath;
}

/**
 * Finds changed metadata by its logical display path.
 *
 * @param overview - Current repository overview.
 * @param path - Logical repository path.
 * @returns Matching file metadata, or null.
 */
export function findRepositoryDiffFile(
  overview: RepositoryDiffOverview,
  path: string,
): RepositoryDiffFile | null {
  return (
    overview.changed.find(
      (file) => getRepositoryDiffLogicalPath(file) === path,
    ) ?? null
  );
}

/**
 * Collects repository-wide valid file paths independent of the active filter.
 *
 * @param overview - Current repository overview.
 * @param nodes - Loaded projection nodes, including ignored pages.
 * @returns Ordered de-duplicated file paths.
 */
export function collectValidRepositoryFilePaths(
  overview: RepositoryDiffOverview,
  nodes: readonly RepositoryDiffTreeProjectionNode[],
): readonly string[] {
  const paths = new Set(overview.allPaths);
  overview.changed.forEach((file) => {
    const path = getRepositoryDiffLogicalPath(file);
    if (path !== null) {
      paths.add(path);
    }
  });
  collectLoadedFilePaths(nodes, paths);
  return [...paths];
}

/**
 * Counts added and removed structured diff rows.
 *
 * @param fileDiff - Source-neutral file diff.
 * @returns Add/delete totals, or null when rows are omitted.
 */
export function summarizeFileDiff(fileDiff: FileDiff): DiffLineSummary | null {
  const structuredDiff = fileDiff.review.structuredDiff;
  if (structuredDiff.state === "omitted") {
    return null;
  }

  let additions = 0;
  let deletions = 0;
  structuredDiff.hunks.forEach((hunk) => {
    hunk.lines.forEach((line) => {
      if (line.kind === "added") {
        additions += 1;
      }
      if (line.kind === "removed") {
        deletions += 1;
      }
    });
  });
  return { additions, deletions };
}

/**
 * Formats a revision or snapshot identifier for compact UI display.
 *
 * @param value - Full identifier.
 * @returns Compact identifier or an unresolved label.
 */
export function formatRevisionIdentifier(value: string | null): string {
  if (value === null) {
    return "未解決";
  }

  const snapshotMatch = SnapshotPattern.exec(value);
  if (snapshotMatch !== null) {
    return `rs1_${snapshotMatch[1]?.slice(0, 8) ?? ""}`;
  }

  return GitObjectPattern.test(value) ? value.slice(0, 7) : value;
}

/**
 * Adds loaded file nodes recursively to a path set.
 *
 * @param nodes - Projection nodes to visit.
 * @param paths - Mutable collection owned by the caller.
 */
function collectLoadedFilePaths(
  nodes: readonly RepositoryDiffTreeProjectionNode[],
  paths: Set<string>,
): void {
  nodes.forEach((node) => {
    if (node.kind === "file") {
      paths.add(node.path);
    }
    collectLoadedFilePaths(node.children.items, paths);
  });
}
