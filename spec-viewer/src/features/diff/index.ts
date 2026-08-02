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
export { Hunk, StructuredDiff } from "./domain/fileDiff";
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
export type { ViewMode } from "@/features/workspace/types/viewMode";
