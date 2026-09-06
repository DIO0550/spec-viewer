import type { WorkspaceState } from "@/features/workspace/application/workspaceState";
import type { Workspace } from "@/features/workspace/domain/workspace";
import type { WorkspaceError } from "@/features/workspace/domain/workspaceError";

/**
 * @param state - Current workspace application state.
 * @returns The active or preserved workspace stored in workspace state.
 */
export function selectWorkspace(state: WorkspaceState): Workspace | null {
  if (state.status === "opened") {
    return state.workspace;
  }

  if (state.status === "opening") {
    return state.currentWorkspace;
  }

  return null;
}

/** @returns The canonical active workspace root derived only from workspace.root. */
export function selectActiveWorkspaceRoot(
  state: WorkspaceState,
): string | null {
  const workspace = selectWorkspace(state);

  return workspace?.root ?? null;
}

/** @returns The path currently being opened or the path that failed to open. */
export function selectRequestedWorkspacePath(
  state: WorkspaceState,
): string | null {
  if (state.status === "opening" || state.status === "failed") {
    return state.requestedPath;
  }

  return null;
}

/** @returns The workspace-domain error for display, if one exists. */
export function selectWorkspaceError(
  state: WorkspaceState,
): WorkspaceError | null {
  if (state.status === "opened") {
    return state.lastOpenError;
  }

  if (state.status === "failed") {
    return state.error;
  }

  return null;
}

/**
 * @param state - Current workspace application state.
 * @returns True when a workspace open request is currently in progress.
 */
export function selectIsWorkspaceOpening(state: WorkspaceState): boolean {
  return state.status === "opening";
}
