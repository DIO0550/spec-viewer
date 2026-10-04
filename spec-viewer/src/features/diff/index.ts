export {
  ChangesNavigation,
  type ChangesNavigationAvailability,
  type ChangesNavigationProps,
} from "./components/ChangesNavigation";
export {
  CurrentFileViewer,
  type CurrentFileViewerProps,
} from "./components/CurrentFileViewer";
export { DiffViewer, type DiffViewerProps } from "./components/DiffViewer";
export {
  DiffViewModeControls,
  type DiffViewModeControlsProps,
} from "./components/DiffViewModeControls";
export {
  RevisionSelector,
  type RevisionSelectorProps,
} from "./components/RevisionSelector";
export {
  DiffWorkspace,
  type DiffWorkspaceProps,
  type DiffWorkspaceState,
} from "./components/DiffWorkspace";
export {
  ViewModeToolbar,
  type ViewModeToolbarProps,
} from "./components/ViewModeToolbar";
export { DiffAvailability } from "./domain/diffAvailability";
export type { RepositoryUnavailableCode } from "./domain/diffAvailability";
export { SpecChange } from "./domain/specDiffWorkspaceState";
export type {
  SpecChangeOverview,
  SpecDiffSelection,
  SpecDiffWorkspaceState,
} from "./domain/specDiffWorkspaceState";
export { useSpecDiffWorkspace } from "./hooks/useSpecDiffWorkspace";
export type {
  UseSpecDiffWorkspaceOptions,
  UseSpecDiffWorkspaceResult,
} from "./hooks/useSpecDiffWorkspace";
export { ComparisonRevision } from "./domain/comparisonRevision";
export type {
  RevisionOption,
  SpecFileCommit,
  SpecFileHistory,
  ComparisonRevision as ComparisonRevisionValue,
} from "./domain/comparisonRevision";
export { FileDiff, Hunk, StructuredDiff } from "./domain/fileDiff";
export type {
  ContentClassification,
  DiffLine,
  DiffLineKind,
  DiffLineSource,
  DiffFileIdentity,
  EntryKind,
  FileChange,
  FileChangeStatus,
  FileContent,
  FileDiffAvailability,
  FileReview,
  DiffProjectionViewMode,
  FileReviewViewMode,
  OmissionReason,
  SubmoduleState,
} from "./domain/fileDiff";
export type { ViewMode } from "@/features/workspace/domain";

export type {
  GetSpecFileDiffCommandContract,
  GetSpecFileDiffCommandErrorCode,
  GetSpecFileDiffCommandRequest,
  GetSpecFileDiffCommandResponse,
} from "./infra/tauri/getSpecFileDiff";
export {
  GET_SPEC_FILE_DIFF_COMMAND,
  GetSpecFileDiffCommandError,
  getSpecFileDiff,
} from "./infra/tauri/getSpecFileDiff";
export type {
  ListChangedSpecFilesCommandContract,
  ListChangedSpecFilesCommandErrorCode,
  ListChangedSpecFilesCommandRequest,
  ListChangedSpecFilesCommandResponse,
  SpecDiffBackendErrorCode,
} from "./infra/tauri/listChangedSpecFiles";
export {
  LIST_CHANGED_SPEC_FILES_COMMAND,
  ListChangedSpecFilesCommandError,
  listChangedSpecFiles,
} from "./infra/tauri/listChangedSpecFiles";
export type { ListSpecDiffRevisionsRequest } from "./infra/tauri/listSpecDiffRevisions";
export {
  LIST_SPEC_DIFF_REVISIONS_COMMAND,
  listSpecDiffRevisions,
} from "./infra/tauri/listSpecDiffRevisions";
export type { ListSpecFileCommitHistoryRequest } from "./infra/tauri/listSpecFileCommitHistory";
export {
  LIST_SPEC_FILE_COMMIT_HISTORY_COMMAND,
  listSpecFileCommitHistory,
} from "./infra/tauri/listSpecFileCommitHistory";

export {
  getFileChangePresentation,
  type FileChangePresentation,
} from "./lib/fileChangePresentation";
