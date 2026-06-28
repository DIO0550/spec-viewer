export { OpenWorkspaceEmptyState } from "@/features/workspace/components/OpenWorkspaceEmptyState";
export { WorkspaceDropOverlay } from "@/features/workspace/components/WorkspaceDropOverlay";
export { WorkspaceSidebarSection } from "@/features/workspace/components/WorkspaceSidebarSection";
export { WorkspaceToolbar } from "@/features/workspace/components/WorkspaceToolbar";
export { WorkspaceProvider, useWorkspace } from "./context";
export type { WorkspaceContextValue } from "./context";
export { useRecentWorkspaces } from "./hooks/useRecentWorkspaces";
export { useWorkspaceDrop } from "./hooks/useWorkspaceDrop";
export { useWorkspaceSidebarSectionPreference } from "./hooks/useWorkspaceSidebarSectionPreference";
export type {
  Workspace,
  WorkspaceKind,
} from "@/features/workspace/types/workspace";
