import type {
  ContentClassification,
  EntryKind,
  FileChangeStatus,
  FileContent,
  OmissionReason,
  StructuredDiff,
  SubmoduleState,
} from "@/features/diff/domain/fileDiff";

export type BaseResolutionSource =
  | "explicit"
  | "ghMergeBase"
  | "currentRemoteHead"
  | "originHead"
  | "otherRemoteHead"
  | "main"
  | "master";

export type BaseResolutionFailure =
  | "notFound"
  | "ambiguousRemoteHead"
  | "detachedHead"
  | "shallowHistory"
  | "unbornHead"
  | "noCommonAncestor";

export type BaseResolution =
  | Readonly<{
      state: "resolved";
      source: BaseResolutionSource;
      branchRef: string;
      mergeBaseSha: string;
      headSha: string;
    }>
  | Readonly<{
      state: "needsSelection";
      reason: BaseResolutionFailure;
      candidates: readonly string[];
    }>
  | Readonly<{
      state: "invalidOverride";
      reason: "missingRef" | "invalidRef";
      overrideRef: string;
    }>;

export type RepositoryDiffFile = Readonly<{
  oldPath: string | null;
  newPath: string | null;
  change: FileChangeStatus | null;
  entryKind: EntryKind;
  contentClassification: ContentClassification;
  similarity: number | null;
  oldMode: string | null;
  newMode: string | null;
}>;

export type RepositoryChangedFile = Readonly<
  Omit<RepositoryDiffFile, "change"> & { change: FileChangeStatus }
>;

export type RepositoryTreeChildren =
  | Readonly<{
      state: "loaded";
      items: readonly RepositoryTreeNode[];
    }>
  | Readonly<{
      state: "deferred";
      nodeId: string;
    }>;

export type RepositoryTreeNode = Readonly<{
  path: string;
  name: string;
  kind: "file" | "directory";
  entryKind: EntryKind | null;
  change: FileChangeStatus | null;
  ignored: boolean;
  children: RepositoryTreeChildren;
}>;

export type RepositoryDiffOverview = Readonly<{
  repositoryId: string | null;
  base: BaseResolution;
  currentSnapshotId: string | null;
  changed: readonly RepositoryChangedFile[];
  changedTree: readonly RepositoryTreeNode[];
  allRoot: readonly RepositoryTreeNode[];
  allPaths: readonly string[];
  ignoredDirectories: readonly string[];
  warnings: readonly string[];
}>;

export type RepositoryDiffFilter = "changed" | "all";

export type RepositoryDiffSelectionRequest = Readonly<{
  worktreeId: string;
  path: string;
}>;

export type RepositoryDiffStatusCounts = Readonly<
  Partial<Record<FileChangeStatus, number>>
>;

export type RepositoryDiffSummary = Readonly<{
  filter: RepositoryDiffFilter;
  totalPaths: number;
  changedPaths: number;
  statusCounts: RepositoryDiffStatusCounts;
  ignoredDirectoryCount: number;
}>;

export type RepositoryDiffTreeProjectionNode = Readonly<{
  id: string;
  path: string;
  name: string;
  kind: "file" | "directory";
  entryKind: EntryKind | null;
  contentClassification: ContentClassification | null;
  oldPath: string | null;
  change: FileChangeStatus | null;
  ignored: boolean;
  deferredNodeId: string | null;
  children: Readonly<{
    state: "loaded" | "deferred" | "loading" | "failed";
    items: readonly RepositoryDiffTreeProjectionNode[];
    nextCursor: string | null;
    message: string | null;
  }>;
}>;

export type RepositoryFileReview = Readonly<{
  file: RepositoryDiffFile;
  oldContent: FileContent;
  newContent: FileContent;
  patch: FileContent;
  structuredDiff: StructuredDiff;
  submodule: SubmoduleState | null;
}>;

export type IgnoredPage = Readonly<{
  nodeId: string;
  entries: readonly RepositoryTreeNode[];
  nextCursor: string | null;
}>;

export type RepositoryDiffSelection = Readonly<{
  worktreeId: string;
  snapshotId: string;
  path: string;
}>;

export const RepositoryDiffSelection = {
  /**
   * @param selection - Worktree/snapshot/path selection.
   * @returns A collision-resistant navigation key.
   */
  key(selection: RepositoryDiffSelection): string {
    return [
      encodeURIComponent(selection.worktreeId),
      encodeURIComponent(selection.snapshotId),
      encodeURIComponent(selection.path),
    ].join(":");
  },
} as const;

export type RepositoryDiffProjectionItem = Readonly<{
  id: string;
  path: string;
  change: FileChangeStatus | null;
  ignored: boolean;
  deferredNodeId: string | null;
}>;

export type RepositoryDiffContentOmission = Extract<
  FileContent,
  { state: "omitted" }
>;

export type RepositoryDiffOmissionReason = OmissionReason;
