export { OpenWorkspaceEmptyState } from "@/features/workspace/components/OpenWorkspaceEmptyState";
export { WorkspaceDropOverlay } from "@/features/workspace/components/WorkspaceDropOverlay";
export { WorkspaceSidebarSection } from "@/features/workspace/components/WorkspaceSidebarSection";
export { WorkspaceToolbar } from "@/features/workspace/components/WorkspaceToolbar";
export type {
  Workspace,
  WorkspaceKind,
} from "@/features/workspace/domain/workspace";
export type {
  WorkspaceActions,
  WorkspaceContextValue,
  WorkspaceState,
} from "./context";
export {
  selectActiveWorkspaceRoot,
  selectIsWorkspaceOpening,
  selectRequestedWorkspacePath,
  selectWorkspace,
  selectWorkspaceError,
  useWorkspace,
  WorkspaceProvider,
} from "./context";
export { useRecentWorkspaces } from "./hooks/useRecentWorkspaces";
export { useWorkspaceDrop } from "./hooks/useWorkspaceDrop";
export { useWorkspaceLoader } from "./hooks/useWorkspaceLoader";
export { useWorkspaceSidebarSectionPreference } from "./hooks/useWorkspaceSidebarSectionPreference";
