import type {
  FileChangeStatus,
  FileDiff,
  OmissionReason,
} from "@/features/diff/domain/fileDiff";
import { deriveDiffAvailability } from "@/features/diff/domain/fileDiff";
import type {
  IgnoredPage,
  RepositoryDiffFilter,
  RepositoryDiffOverview,
  RepositoryDiffProjectionItem,
  RepositoryDiffSelection,
  RepositoryDiffSummary,
  RepositoryDiffTreeProjectionNode,
  RepositoryFileReview,
  RepositoryTreeNode,
} from "@/features/repositoryDiff/domain/repositoryDiff";
import type { RepositoryDiffIgnoredPageState } from "@/features/repositoryDiff/domain/repositoryDiffWorkspaceState";

export type RepositoryFileReviewProjection = Readonly<{
  path: string;
  availability: "ready" | "binary" | "deleted" | "omitted";
  omissionReason: OmissionReason | null;
  review: RepositoryFileReview;
  selection: RepositoryDiffSelection;
}>;

type ProjectionScope = Readonly<{
  worktreeId: string;
  baseKey: string;
  snapshotId: string;
  path: string;
  oldPath: string | null;
  deferredNodeId?: string | null;
}>;

/**
 * @param overview - Decoded repository-wide overview.
 * @param worktreeId - Active worktree identity.
 * @returns Changed files projected for generic navigation.
 */
export function projectChangedFiles(
  overview: RepositoryDiffOverview,
  worktreeId: string,
): readonly RepositoryDiffProjectionItem[] {
  return overview.changed.map((file) =>
    projectFile(
      file.newPath ?? file.oldPath ?? "",
      file.change,
      false,
      null,
      file.oldPath,
      overview,
      worktreeId,
    ),
  );
}

/**
 * @param nodes - Repository tree nodes to flatten.
 * @param overview - Overview supplying base/snapshot identity.
 * @param worktreeId - Active worktree identity.
 * @returns Flattened tree items including ignored and deferred metadata.
 */
export function projectRepositoryTree(
  nodes: readonly RepositoryTreeNode[],
  overview: RepositoryDiffOverview,
  worktreeId: string,
): readonly RepositoryDiffProjectionItem[] {
  return nodes.flatMap((node) =>
    projectNode(node, overview, worktreeId, false),
  );
}

/**
 * @param page - Decoded lazy ignored directory page.
 * @param overview - Overview supplying base/snapshot identity.
 * @param worktreeId - Active worktree identity.
 * @returns Ignored page entries projected without inventing change status.
 */
export function projectIgnoredPage(
  page: IgnoredPage,
  overview: RepositoryDiffOverview,
  worktreeId: string,
): readonly RepositoryDiffProjectionItem[] {
  return page.entries.flatMap((node) =>
    projectNode(node, overview, worktreeId, true),
  );
}

/**
 * @param review - Decoded repository file review.
 * @param selection - Snapshot-scoped repository selection.
 * @returns A generic file-review view model for Diff UI composition.
 */
export function projectFileReview(
  review: RepositoryFileReview,
  selection: RepositoryDiffSelection,
): RepositoryFileReviewProjection {
  const path = review.file.newPath ?? review.file.oldPath ?? selection.path;
  const omissionReason = findOmissionReason(review);
  const availability =
    review.file.change === "deleted"
      ? "deleted"
      : review.file.contentClassification === "binary" ||
          omissionReason === "binary"
        ? "binary"
        : omissionReason === null
          ? "ready"
          : "omitted";

  return { path, availability, omissionReason, review, selection };
}

/**
 * Adapts a repository review at the generic DiffViewer boundary.
 *
 * @param review - Decoded repository file review.
 * @param selection - Snapshot-scoped repository selection.
 * @returns Generic viewer input; repository identity remains at the adapter boundary.
 */
export function toDiffViewerFileDiff(
  review: RepositoryFileReview,
  selection: RepositoryDiffSelection,
): FileDiff {
  return {
    identity: {
      sourceId: `repository:${selection.worktreeId}`,
      path: selection.path,
    },
    review,
    availability: deriveDiffAvailability(review),
  };
}

/**
 * @param node - Tree node to project.
 * @param overview - Overview supplying base/snapshot identity.
 * @param worktreeId - Active worktree identity.
 * @param forceIgnored - Whether the page boundary marks the node ignored.
 * @returns A flattened node projection.
 */
function projectNode(
  node: RepositoryTreeNode,
  overview: RepositoryDiffOverview,
  worktreeId: string,
  forceIgnored: boolean,
): readonly RepositoryDiffProjectionItem[] {
  const item = projectFile(
    node.path,
    node.change,
    forceIgnored || node.ignored,
    node.children.state === "deferred" ? node.children.nodeId : null,
    null,
    overview,
    worktreeId,
  );
  const shouldExposeNode =
    node.kind === "file" || node.children.state === "deferred";
  const projectedNode = shouldExposeNode ? [item] : [];
  if (node.children.state === "deferred") {
    return projectedNode;
  }
  return [
    ...projectedNode,
    ...node.children.items.flatMap((child) =>
      projectNode(child, overview, worktreeId, forceIgnored || node.ignored),
    ),
  ];
}

/**
 * @param path - Repository-relative display path.
 * @param change - Optional file change status.
 * @param ignored - Whether the node is ignored.
 * @param deferredNodeId - Lazy node identity when children are deferred.
 * @param oldPath - Previous path for rename/copy identity.
 * @param overview - Overview supplying base/snapshot identity.
 * @param worktreeId - Active worktree identity.
 * @returns A stable generic navigation item.
 */
function projectFile(
  path: string,
  change: FileChangeStatus | null,
  ignored: boolean,
  deferredNodeId: string | null,
  oldPath: string | null,
  overview: RepositoryDiffOverview,
  worktreeId: string,
): RepositoryDiffProjectionItem {
  return {
    id: createProjectionId({
      worktreeId,
      baseKey: createBaseKey(overview),
      snapshotId: overview.currentSnapshotId ?? "unresolved",
      path,
      oldPath,
    }),
    path,
    change,
    ignored,
    deferredNodeId,
  };
}

/**
 * @param overview - Overview whose base identity is encoded.
 * @returns Stable base identity for navigation keys.
 */
function createBaseKey(overview: RepositoryDiffOverview): string {
  if (overview.base.state === "resolved") {
    return overview.base.mergeBaseSha;
  }
  if (overview.base.state === "invalidOverride") {
    return `${overview.base.state}:${overview.base.overrideRef}`;
  }
  return `${overview.base.state}:${overview.base.reason}`;
}

/**
 * @param scope - Identity components for one projected item.
 * @returns Collision-resistant encoded navigation identity.
 */
function createProjectionId(scope: ProjectionScope): string {
  const parts = [
    scope.worktreeId,
    scope.baseKey,
    scope.snapshotId,
    scope.path,
    scope.oldPath ?? "",
  ];
  if (scope.deferredNodeId !== undefined) {
    parts.push(scope.deferredNodeId ?? "");
  }
  return parts.map((part) => encodeURIComponent(part)).join(":");
}

/**
 * @param review - Repository review whose content may be omitted.
 * @returns The first omission reason, or null when all content is available.
 */
function findOmissionReason(
  review: RepositoryFileReview,
): OmissionReason | null {
  const candidates = [
    review.patch,
    review.oldContent,
    review.newContent,
    review.structuredDiff,
  ];
  const omitted = candidates.find((candidate) => candidate.state === "omitted");
  return omitted?.reason ?? null;
}

export type ProjectRepositoryDiffTreeOptions = Readonly<{
  nodes: readonly RepositoryTreeNode[];
  overview: RepositoryDiffOverview;
  worktreeId: string;
  filter: RepositoryDiffFilter;
  ignoredPages: Readonly<Record<string, IgnoredPage>>;
  ignoredPageStates: Readonly<Record<string, RepositoryDiffIgnoredPageState>>;
}>;

/**
 * Projects the selected repository root into a nested tree view model.
 *
 * @param options - Overview, root nodes and lazy ignored-page state.
 * @returns A stable, recursively projected repository tree.
 */
export function projectRepositoryDiffTree(
  options: ProjectRepositoryDiffTreeOptions,
): readonly RepositoryDiffTreeProjectionNode[] {
  return projectTreeNodes(options.nodes, options, false);
}

/**
 * Derives logical repository counts from the existing overview contract.
 *
 * @param overview - Repository-wide overview.
 * @param filter - Current Diff-local filter.
 * @returns Summary counts without adding lazy page entries.
 */
export function deriveRepositoryDiffSummary(
  overview: RepositoryDiffOverview,
  filter: RepositoryDiffFilter,
): RepositoryDiffSummary {
  const statusCounts = overview.changed.reduce<
    Partial<Record<FileChangeStatus, number>>
  >((counts, file) => {
    counts[file.change] = (counts[file.change] ?? 0) + 1;
    return counts;
  }, {});

  return {
    filter,
    totalPaths:
      filter === "changed" ? overview.changed.length : overview.allPaths.length,
    changedPaths: overview.changed.length,
    statusCounts,
    ignoredDirectoryCount: overview.ignoredDirectories.length,
  };
}

function projectTreeNodes(
  nodes: readonly RepositoryTreeNode[],
  options: ProjectRepositoryDiffTreeOptions,
  inheritedIgnored: boolean,
): readonly RepositoryDiffTreeProjectionNode[] {
  const seenPaths = new Set<string>();
  return nodes.flatMap((node) => {
    if (seenPaths.has(node.path)) {
      return [];
    }
    seenPaths.add(node.path);
    return [projectTreeNode(node, options, inheritedIgnored)];
  });
}

function projectTreeNode(
  node: RepositoryTreeNode,
  options: ProjectRepositoryDiffTreeOptions,
  inheritedIgnored: boolean,
): RepositoryDiffTreeProjectionNode {
  const deferredNodeId =
    node.children.state === "deferred" ? node.children.nodeId : null;
  const changedFile = options.overview.changed.find(
    (file) => file.newPath === node.path || file.oldPath === node.path,
  );

  return {
    id: createProjectionId({
      worktreeId: options.worktreeId,
      baseKey: createBaseKey(options.overview),
      snapshotId: options.overview.currentSnapshotId ?? "unresolved",
      path: node.path,
      oldPath: changedFile?.oldPath ?? null,
      deferredNodeId,
    }),
    path: node.path,
    name: node.name,
    kind: node.kind,
    entryKind: node.entryKind,
    contentClassification: changedFile?.contentClassification ?? null,
    oldPath: changedFile?.oldPath ?? null,
    change: node.change ?? changedFile?.change ?? null,
    ignored: inheritedIgnored || node.ignored,
    deferredNodeId,
    children: projectTreeChildren(node, options, inheritedIgnored),
  };
}

function projectTreeChildren(
  node: RepositoryTreeNode,
  options: ProjectRepositoryDiffTreeOptions,
  inheritedIgnored: boolean,
): RepositoryDiffTreeProjectionNode["children"] {
  if (node.children.state === "loaded") {
    return {
      state: "loaded",
      items: projectTreeNodes(
        node.children.items,
        options,
        inheritedIgnored || node.ignored,
      ),
      nextCursor: null,
      message: null,
    };
  }

  const deferredNodeId = node.children.nodeId;
  if (options.filter !== "all") {
    return {
      state: "deferred",
      items: [],
      nextCursor: null,
      message: null,
    };
  }

  const page = options.ignoredPages[deferredNodeId];
  const pageState = options.ignoredPageStates[deferredNodeId];
  const state =
    pageState?.status === "loading"
      ? "loading"
      : pageState?.status === "failed"
        ? "failed"
        : page === undefined
          ? "deferred"
          : "loaded";

  return {
    state,
    items:
      page === undefined ? [] : projectTreeNodes(page.entries, options, true),
    nextCursor: page?.nextCursor ?? null,
    message: pageState?.status === "failed" ? pageState.error.message : null,
  };
}
