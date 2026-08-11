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
export {
  createSpecChangeId,
  findSpecChange,
  projectSpecChangeBadges,
} from "./domain/specDiffWorkspaceState";
export type {
  SpecChange,
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
  ComparisonRevision as ComparisonRevisionValue,
  RevisionOption,
  SpecFileCommit,
  SpecFileHistory,
} from "./domain/comparisonRevision";
export {
  deriveDiffAvailability,
  Hunk,
  StructuredDiff,
} from "./domain/fileDiff";
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
  FileDiff,
  FileDiffAvailability,
  FileReview,
  DiffProjectionViewMode,
  FileReviewViewMode,
  OmissionReason,
  SubmoduleState,
} from "./domain/fileDiff";
export type { ViewMode } from "@/features/workspace/types/viewMode";
