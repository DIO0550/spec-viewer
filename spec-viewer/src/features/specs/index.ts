export { SpecArtifactTabs } from "@/features/specs/components/SpecArtifactTabs";
export {
  SpecArtifactViewer,
  type SpecArtifactViewerProps,
} from "@/features/specs/components/SpecArtifactViewer";
export {
  MarkdownViewer,
  type MarkdownViewerProps,
} from "@/features/specs/components/MarkdownViewer";
export {
  createRenderedBlockKey,
  readRenderedBlockModel,
  type RenderedBlockModel,
  type RenderedBlockProjection,
  type RenderedBlockType,
  type RenderedDocumentPort,
  type RenderedTextDecoration,
} from "@/features/specs/components/MarkdownViewer/renderedDocument";
export { SpecBundleState } from "@/features/specs/domain/specBundleState";
export { SpecTabs } from "@/features/specs/components/SpecTabs";
export { SpecTree } from "@/features/specs/components/SpecTree";
export {
  type SpecDocumentState,
  type SpecSelectionChange,
  type SpecTreeState,
  type UseSpecsResult,
  useSpecs,
} from "@/features/specs/hooks/useSpecs";
export type {
  SpecSelectionState,
  SpecsActions,
  SpecsState,
} from "@/features/specs/hooks/useSpecs/types";
export type {
  MarkdownBlockMetadata,
  MarkdownBlockType,
  SpecArtifact,
  SpecBundle,
  SpecDocument,
  SpecFile,
  SpecFileKey,
  SpecFileScope,
  SpecNode,
  SpecTree as SpecTreeData,
} from "@/features/specs/types/spec";
export { useSpecFileWatcher } from "./hooks/useSpecFileWatcher";
export type { SpecFileWatchNotification } from "./domain/specFileWatchNotification";

export type { SpecCommands } from "./application/specCommands";
export type {
  SpecFileWatchCommands,
  SpecWatchSubscriber,
  StartSpecFileWatchCommand,
  StopSpecFileWatchCommand,
} from "./application/specFileWatchPort";
export { specCommands } from "./infra/tauri/specCommands";
export { specFileWatchCommands } from "./infra/tauri/specFileWatchCommands";
export {
  createSpecWatchSubscriber,
  subscribeToSpecFileWatch,
  SPEC_FILE_WATCH_CHANGED_EVENT,
  SPEC_FILE_WATCH_ERROR_EVENT,
  type RawEventSubscriber,
} from "./infra/tauri/specFileWatchEvents";
export {
  ARCHIVE_SPEC_COMMAND,
  type ArchiveSpecCommandName,
  type ArchiveSpecCommandRequest,
  type ArchiveSpecCommandResponse,
  type ArchiveSpecCommandErrorCode,
  ArchiveSpecCommandError,
  type ArchiveSpecCommandContract,
  archiveSpec,
} from "./infra/tauri/archiveSpec";
export {
  LIST_SPECS_COMMAND,
  type ListSpecsCommandName,
  type ListSpecsCommandRequest,
  type ListSpecsCommandResponse,
  type ListSpecsCommandErrorCode,
  ListSpecsCommandError,
  type ListSpecsCommandContract,
  listSpecs,
} from "./infra/tauri/listSpecs";
export {
  LOAD_SPEC_BUNDLE_COMMAND,
  type LoadSpecBundleCommandName,
  type LoadSpecBundleCommandRequest,
  type LoadSpecBundleCommandResponse,
  type LoadSpecBundleCommandErrorCode,
  LoadSpecBundleCommandError,
  type LoadSpecBundleCommandContract,
  loadSpecBundle,
} from "./infra/tauri/loadSpecBundle";
export {
  READ_SPEC_FILE_COMMAND,
  type ReadSpecFileCommandName,
  type ReadSpecFileCommandRequest,
  type ReadSpecFileCommandResponse,
  type ReadSpecFileCommandErrorCode,
  ReadSpecFileCommandError,
  type ReadSpecFileCommandContract,
  readSpecFile,
} from "./infra/tauri/readSpecFile";
export {
  START_SPEC_FILE_WATCH_COMMAND,
  type StartSpecFileWatchCommandName,
  type StartSpecFileWatchCommandRequest,
  type StartSpecFileWatchCommandResponse,
  type StartSpecFileWatchCommandErrorCode,
  StartSpecFileWatchCommandError,
  type StartSpecFileWatchCommandContract,
  startSpecFileWatch,
} from "./infra/tauri/startSpecFileWatch";
export {
  STOP_SPEC_FILE_WATCH_COMMAND,
  type StopSpecFileWatchCommandName,
  type StopSpecFileWatchCommandRequest,
  type StopSpecFileWatchCommandResponse,
  type StopSpecFileWatchCommandErrorCode,
  StopSpecFileWatchCommandError,
  type StopSpecFileWatchCommandContract,
  stopSpecFileWatch,
} from "./infra/tauri/stopSpecFileWatch";

export {
  SelectionIdentity,
  SpecId,
  SpecViewSelection,
  type SpecViewSelectionInput,
  type SpecViewTargetScope,
  type SpecViewFileTarget,
  type SpecViewReviewTarget,
} from "./domain";
export type { SpecFileWatchSubscriber } from "./hooks/useSpecFileWatcher";
