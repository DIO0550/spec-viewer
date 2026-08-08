import type {
  EntryKind,
  FileChange,
  FileChangeStatus,
  FileReview,
} from "@/features/diff/domain/fileDiff";

declare const repositoryWorktreeIdBrand: unique symbol;
export type RepositoryWorktreeId = string & {
  readonly [repositoryWorktreeIdBrand]: true;
};
export const RepositoryWorktreeId = {
  /**
   * @param value - Raw worktree identifier issued by the backend.
   * @returns The branded worktree identifier.
   */
  fromString(value: string): RepositoryWorktreeId {
    return value as RepositoryWorktreeId;
  },
  /**
   * @param value - Branded worktree identifier.
   * @returns Raw string for IPC boundaries.
   */
  toString(value: RepositoryWorktreeId): string {
    return value;
  },
} as const;

declare const repositoryIdBrand: unique symbol;
export type RepositoryId = string & { readonly [repositoryIdBrand]: true };
export const RepositoryId = {
  /**
   * @param value - Raw opaque repository identifier issued by the backend.
   * @returns The branded repository identifier.
   */
  fromString(value: string): RepositoryId {
    return value as RepositoryId;
  },
  /**
   * @param value - Branded repository identifier.
   * @returns Raw string for IPC boundaries.
   */
  toString(value: RepositoryId): string {
    return value;
  },
} as const;

/** Identifies the snapshot composed of commit, staged, unstaged and untracked state. */
declare const repositoryCurrentSnapshotIdBrand: unique symbol;
export type RepositoryCurrentSnapshotId = string & {
  readonly [repositoryCurrentSnapshotIdBrand]: true;
};
export const RepositoryCurrentSnapshotId = {
  /**
   * @param value - Raw opaque snapshot identifier issued by the backend.
   * @returns The branded snapshot identifier.
   */
  fromString(value: string): RepositoryCurrentSnapshotId {
    return value as RepositoryCurrentSnapshotId;
  },
  /**
   * @param value - Branded snapshot identifier.
   * @returns Raw string for IPC boundaries.
   */
  toString(value: RepositoryCurrentSnapshotId): string {
    return value;
  },
} as const;

declare const repositoryNodeIdBrand: unique symbol;
export type RepositoryNodeId = string & {
  readonly [repositoryNodeIdBrand]: true;
};
export const RepositoryNodeId = {
  /**
   * @param value - Raw opaque tree node identifier issued by the backend.
   * @returns The branded node identifier.
   */
  fromString(value: string): RepositoryNodeId {
    return value as RepositoryNodeId;
  },
  /**
   * @param value - Branded node identifier.
   * @returns Raw string for IPC boundaries.
   */
  toString(value: RepositoryNodeId): string {
    return value;
  },
} as const;

declare const repositoryIgnoredCursorBrand: unique symbol;
export type RepositoryIgnoredCursor = string & {
  readonly [repositoryIgnoredCursorBrand]: true;
};
export const RepositoryIgnoredCursor = {
  /**
   * @param value - Raw opaque pagination cursor issued by the backend.
   * @returns The branded cursor.
   */
  fromString(value: string): RepositoryIgnoredCursor {
    return value as RepositoryIgnoredCursor;
  },
  /**
   * @param value - Branded cursor.
   * @returns Raw string for IPC boundaries.
   */
  toString(value: RepositoryIgnoredCursor): string {
    return value;
  },
} as const;

/** The four change sources the current snapshot composes. */
export const REPOSITORY_CURRENT_SNAPSHOT_SOURCES = [
  "commit",
  "staged",
  "unstaged",
  "untracked",
] as const;
export type RepositoryCurrentSnapshotSource =
  (typeof REPOSITORY_CURRENT_SNAPSHOT_SOURCES)[number];

export const BASE_RESOLUTION_SOURCES = [
  "explicit",
  "ghMergeBase",
  "currentRemoteHead",
  "originHead",
  "otherRemoteHead",
  "main",
  "master",
] as const;
export type BaseResolutionSource = (typeof BASE_RESOLUTION_SOURCES)[number];

export const BASE_RESOLUTION_FAILURES = [
  "notFound",
  "ambiguousRemoteHead",
  "detachedHead",
  "shallowHistory",
  "unbornHead",
  "noCommonAncestor",
] as const;
export type BaseResolutionFailure = (typeof BASE_RESOLUTION_FAILURES)[number];

export const BASE_OVERRIDE_REJECTIONS = ["invalidRef", "missingRef"] as const;
export type BaseOverrideRejection = (typeof BASE_OVERRIDE_REJECTIONS)[number];

/** The flat `BaseResponse` payload promoted to a discriminated union. */
export type BaseResolution =
  | Readonly<{
      state: "resolved";
      /** Null whenever the backend did not take the overview code path. */
      source: BaseResolutionSource | null;
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
      reason: BaseOverrideRejection;
      overrideRef: string;
    }>;

export const BaseResolution = {
  /**
   * @param value - Base resolution to inspect.
   * @returns True when a base commit was resolved and a diff is computable.
   */
  isResolved(
    value: BaseResolution,
  ): value is Extract<BaseResolution, { state: "resolved" }> {
    return value.state === "resolved";
  },

  /**
   * @param value - Base resolution to inspect.
   * @returns True when the user must pick a base branch, including unborn HEAD.
   */
  needsUserSelection(value: BaseResolution): boolean {
    return value.state === "needsSelection";
  },
} as const;

export const REPOSITORY_TREE_NODE_KINDS = ["file", "directory"] as const;
export type RepositoryTreeNodeKind =
  (typeof REPOSITORY_TREE_NODE_KINDS)[number];

/** Mirrors the backend's only serde-tagged enum (`tag = "state"`). */
export type RepositoryTreeChildren =
  | Readonly<{ state: "loaded"; items: readonly RepositoryTreeNode[] }>
  | Readonly<{ state: "deferred"; nodeId: RepositoryNodeId }>;

export type RepositoryTreeNode = Readonly<{
  path: string;
  name: string;
  kind: RepositoryTreeNodeKind;
  entryKind: EntryKind | null;
  /** Null means unchanged; orthogonal to `ignored`. */
  change: FileChangeStatus | null;
  /** Whether git ignores the entry; independent of its file status. */
  ignored: boolean;
  children: RepositoryTreeChildren;
}>;

export const RepositoryTreeNode = {
  /**
   * @param node - Tree node to inspect.
   * @returns True only for ignored entries, which are distinct from untracked and unchanged ones.
   */
  isIgnored(node: RepositoryTreeNode): boolean {
    return node.ignored;
  },

  /**
   * @param node - Tree node to inspect.
   * @returns True when children must be fetched via traverse_repository_ignored.
   */
  hasDeferredChildren(node: RepositoryTreeNode): boolean {
    return node.children.state === "deferred";
  },
} as const;

export type RepositoryDiffOverview = Readonly<{
  /** Null when `base.state === "invalidOverride"`. */
  repositoryId: RepositoryId | null;
  base: BaseResolution;
  /** Null when `base.state === "invalidOverride"`. */
  currentSnapshotId: RepositoryCurrentSnapshotId | null;
  changed: readonly FileChange[];
  changedTree: readonly RepositoryTreeNode[];
  /** The authoritative hierarchical tree. */
  allRoot: readonly RepositoryTreeNode[];
  /** Flat path list, kept by reference instead of copied. */
  all: readonly string[];
  ignoredDirectories: readonly string[];
  /** Passed through unvalidated; the backend does not define a closed set. */
  warnings: readonly string[];
}>;

export type RepositoryIgnoredPage = Readonly<{
  nodeId: RepositoryNodeId;
  entries: readonly RepositoryTreeNode[];
  /** Null terminates pagination; one page holds at most 200 entries. */
  nextCursor: RepositoryIgnoredCursor | null;
}>;

/**
 * The Spec-free alias of `FileReview`, carrying no `specId` or `fileKey`.
 *
 * Deliberately not re-exported from `features/diff/index.ts`: `FileReview` is
 * already public there, and a second public name for one type would recreate
 * the duplicate-concept problem the shared classifier avoids.
 */
export type RepositoryFileReview = FileReview;

export const RepositoryDiffOverview = {
  /**
   * @param overview - Overview to inspect.
   * @returns True when lazy expansion and file review can be requested.
   */
  isSnapshotUsable(overview: RepositoryDiffOverview): boolean {
    return (
      BaseResolution.isResolved(overview.base) &&
      overview.currentSnapshotId !== null
    );
  },
} as const;
