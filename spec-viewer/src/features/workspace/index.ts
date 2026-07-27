export { OpenWorkspaceEmptyState } from "@/features/workspace/components/OpenWorkspaceEmptyState";
export { WorkspaceDropOverlay } from "@/features/workspace/components/WorkspaceDropOverlay";
export { WorkspaceSidebarSection } from "@/features/workspace/components/WorkspaceSidebarSection";
export { WorkspaceToolbar } from "@/features/workspace/components/WorkspaceToolbar";
export {
  WorktreeTree,
  type WorktreeTreeProps,
} from "@/features/workspace/components/WorktreeTree";
export type {
  ChangedFile,
  Worktree,
  WorktreeId,
  WorktreeSpec,
  WorkspaceId,
  WorkspaceWorktrees,
} from "@/features/workspace/domain/worktree";
export { useWorkspaceNavigationState } from "@/features/workspace/hooks/useWorkspaceNavigationState";
export { projectWorktreeTree } from "@/features/workspace/lib/projectWorktreeTree";
export {
  listWorktreeIdsDepthFirst,
  resolveWorktreeSelection,
} from "@/features/workspace/lib/resolveWorktreeSelection";
export type { ViewMode } from "@/features/workspace/types/viewMode";
export type { WorkspaceNavigationState } from "@/features/workspace/types/workspaceNavigationState";
export type {
  WorkspaceWorktreesLoadState,
  WorkspaceWorktreesUnavailableReason,
} from "@/features/workspace/types/workspaceWorktreesLoadState";
export type {
  WorktreeRowCount,
  WorktreeTreeNode,
} from "@/features/workspace/types/worktreeTreeNode";
export type {
  Workspace,
  WorkspaceKind,
} from "@/features/workspace/types/workspace";
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
