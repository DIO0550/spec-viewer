export {
  ChangesNavigation,
  type ChangesNavigationProps,
} from "./components/ChangesNavigation";
export {
  DiffWorkspace,
  type DiffWorkspaceProps,
} from "./components/DiffWorkspace";
export {
  ViewModeToolbar,
  type ViewModeToolbarProps,
} from "./components/ViewModeToolbar";
export { DiffAvailability } from "./domain/diffAvailability";
export type { RepositoryUnavailableCode } from "./domain/diffAvailability";
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
