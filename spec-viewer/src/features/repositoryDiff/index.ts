export type { RepositoryDiffSummaryProps } from "./components/RepositoryDiffSummary";
export { RepositoryDiffSummary } from "./components/RepositoryDiffSummary";
export type {
  RepositoryDiffTreeAvailability,
  RepositoryDiffTreeProps,
} from "./components/RepositoryDiffTree";
export { RepositoryDiffTree } from "./components/RepositoryDiffTree";
export {
  RepositoryDiffFileHeader,
  type RepositoryDiffFileHeaderProps,
} from "./components/RepositoryDiffFileHeader";
export {
  createRepositoryFileTabId,
  RepositoryFileTabs,
  type RepositoryFileTabItem,
  type RepositoryFileTabsProps,
} from "./components/RepositoryFileTabs";
export type {
  BaseResolution,
  BaseResolutionFailure,
  BaseResolutionSource,
  IgnoredPage,
  RepositoryDiffFile,
  RepositoryDiffFilter,
  RepositoryDiffOverview,
  RepositoryDiffProjectionItem,
  RepositoryDiffSelection,
  RepositoryDiffSelectionRequest,
  RepositoryDiffStatusCounts,
  RepositoryDiffTreeProjectionNode,
  RepositoryFileReview,
  RepositoryTreeChildren,
  RepositoryTreeNode,
} from "./domain/repositoryDiff";
export type {
  UseRepositoryDiffNavigationStateOptions,
  UseRepositoryDiffNavigationStateResult,
} from "./hooks/useRepositoryDiffNavigationState";
export { useRepositoryDiffNavigationState } from "./hooks/useRepositoryDiffNavigationState";
export type {
  RepositoryDiffWorkspaceApi,
  UseRepositoryDiffWorkspaceOptions,
  UseRepositoryDiffWorkspaceResult,
} from "./hooks/useRepositoryDiffWorkspace";
export { useRepositoryDiffWorkspace } from "./hooks/useRepositoryDiffWorkspace";
export type {
  ProjectRepositoryDiffTreeOptions,
  RepositoryFileReviewProjection,
} from "./lib/projectRepositoryDiff";
export {
  deriveRepositoryDiffSummary,
  projectChangedFiles,
  projectFileReview,
  projectIgnoredPage,
  projectRepositoryDiffTree,
  projectRepositoryTree,
  toDiffViewerFileDiff,
} from "./lib/projectRepositoryDiff";
export {
  collectValidRepositoryFilePaths,
  findRepositoryDiffFile,
  formatRevisionIdentifier,
  getRepositoryDiffLogicalPath,
  summarizeFileDiff,
  type DiffLineSummary,
} from "./lib/repositoryDiffFilePresentation";

export type {
  LoadRepositoryDiffRequest,
  LoadRepositoryDiffResponse,
  LoadRepositoryFileRequest,
  LoadRepositoryFileResponse,
  RepositoryDiffAnchor,
  RepositoryDiffBackendErrorCode,
  RepositoryDiffCommandErrorCode,
  RepositoryDiffCommandName,
  TraverseRepositoryIgnoredRequest,
  TraverseRepositoryIgnoredResponse,
} from "./infra/tauri/repositoryDiff";
export {
  LOAD_REPOSITORY_DIFF_COMMAND,
  LOAD_REPOSITORY_FILE_COMMAND,
  RepositoryDiffCommandError,
  TRAVERSE_REPOSITORY_IGNORED_COMMAND,
  loadRepositoryDiff,
  loadRepositoryFile,
  traverseRepositoryIgnored,
} from "./infra/tauri/repositoryDiff";
export { decodeRepositoryOverview } from "./infra/tauri/repositoryDiffDecoder";

export {
  RepositoryDiffWorkspaceState,
  type RepositoryDiffWorkspaceStatus,
} from "./domain/repositoryDiffWorkspaceState";
