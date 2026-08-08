export type { ViewMode } from "@/features/workspace/types/viewMode";
export {
  ChangesNavigation,
  type ChangesNavigationProps,
} from "./components/ChangesNavigation";
export { DiffViewer, type DiffViewerProps } from "./components/DiffViewer";
export {
  DiffWorkspace,
  type DiffWorkspaceProps,
  type DiffWorkspaceState,
} from "./components/DiffWorkspace";
export {
  RevisionSelector,
  type RevisionSelectorProps,
} from "./components/RevisionSelector";
export {
  ViewModeToolbar,
  type ViewModeToolbarProps,
} from "./components/ViewModeToolbar";
export type {
  ComparisonRevision as ComparisonRevisionValue,
  RevisionOption,
  SpecFileCommit,
  SpecFileHistory,
} from "./domain/comparisonRevision";
export { ComparisonRevision } from "./domain/comparisonRevision";
export type {
  DiffStaleCode,
  RepositoryUnavailableCode,
  RepositoryWideOnlyUnavailableCode,
  RepositoryWideUnavailableCode,
} from "./domain/diffAvailability";
export { DiffAvailability } from "./domain/diffAvailability";
export type {
  ContentClassification,
  DiffLine,
  DiffLineKind,
  DiffLineSource,
  EntryKind,
  FileChange,
  FileChangeStatus,
  FileContent,
  FileDiff,
  FileReview,
  OmissionReason,
  SubmoduleState,
} from "./domain/fileDiff";
export { Hunk, StructuredDiff } from "./domain/fileDiff";
export type {
  BaseOverrideRejection,
  BaseResolutionFailure,
  BaseResolutionSource,
  RepositoryCurrentSnapshotSource,
  RepositoryIgnoredPage,
  RepositoryTreeChildren,
  RepositoryTreeNodeKind,
} from "./domain/repositoryDiff";
export {
  BASE_OVERRIDE_REJECTIONS,
  BASE_RESOLUTION_FAILURES,
  BASE_RESOLUTION_SOURCES,
  BaseResolution,
  REPOSITORY_CURRENT_SNAPSHOT_SOURCES,
  REPOSITORY_TREE_NODE_KINDS,
  RepositoryCurrentSnapshotId,
  RepositoryDiffOverview,
  RepositoryId,
  RepositoryIgnoredCursor,
  RepositoryNodeId,
  RepositoryTreeNode,
  RepositoryWorktreeId,
} from "./domain/repositoryDiff";
export type {
  RepositoryCommandError,
  RepositoryInvalidInputCode,
  RepositoryTransientCode,
} from "./domain/repositoryDiffFailure";
export {
  REPOSITORY_INVALID_INPUT_CODES,
  REPOSITORY_TRANSIENT_CODES,
  RepositoryDiffFailure,
} from "./domain/repositoryDiffFailure";
export type {
  LineChangeCounts,
  RepositoryChangeEntry,
  RepositoryTreeEntryClass,
} from "./domain/repositoryDiffProjection";
export {
  classifyTreeEntry,
  countLineChanges,
  projectChangedEntries,
} from "./domain/repositoryDiffProjection";
export type {
  RepositoryDiffAction,
  RepositoryDiffRequestIdentity,
  RepositoryDiffState,
  RepositoryDirectoryExpansion,
  RepositoryFileReviewState,
  RepositoryRefreshState,
} from "./domain/repositoryDiffState";
export {
  createInitialRepositoryDiffState,
  REPOSITORY_DIFF_REFRESH_DEBOUNCE_MS,
  reduceRepositoryDiffState,
  shouldStartOverview,
} from "./domain/repositoryDiffState";
export type {
  SpecChange,
  SpecChangeOverview,
  SpecDiffSelection,
  SpecDiffWorkspaceState,
} from "./domain/specDiffWorkspaceState";
export {
  createSpecChangeId,
  findSpecChange,
  projectSpecChangeBadges,
} from "./domain/specDiffWorkspaceState";
export type {
  UseRepositoryDiffWorkspaceOptions,
  UseRepositoryDiffWorkspaceResult,
} from "./hooks/useRepositoryDiffWorkspace";
export { useRepositoryDiffWorkspace } from "./hooks/useRepositoryDiffWorkspace";
export type {
  UseSpecDiffWorkspaceOptions,
  UseSpecDiffWorkspaceResult,
} from "./hooks/useSpecDiffWorkspace";
export { useSpecDiffWorkspace } from "./hooks/useSpecDiffWorkspace";
