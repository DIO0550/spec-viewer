import type { ViewMode } from "@/features/workspace/types/viewMode";
import type { RepositoryDiffWorkspaceStatus } from "@/features/repositoryDiff/domain/repositoryDiffWorkspaceState";

/**
 * Defers the repository-wide scan until the user opens Diff mode.
 *
 * @param mode - Active top-level view mode.
 * @param openedWorkspacePath - Repository root opened by the user.
 * @returns The repository path only while Diff mode is active.
 */
export function resolveRepositoryDiffWorkspacePath(
  mode: ViewMode,
  openedWorkspacePath: string | null,
): string | null {
  return mode === "diff" ? openedWorkspacePath : null;
}

/**
 * Starts the legacy Spec Diff only when Repository Diff cannot serve the view.
 *
 * @param options - Active mode, selected worktree path, and Repository Diff status.
 * @returns The Spec workspace path for fallback loading, or null while it must stay idle.
 */
export function resolveSpecDiffWorkspacePath(
  options: Readonly<{
    mode: ViewMode;
    activeSpecWorkspacePath: string | null;
    repositoryStatus: RepositoryDiffWorkspaceStatus;
  }>,
): string | null {
  if (options.mode !== "diff") {
    return null;
  }
  if (
    options.repositoryStatus !== "failed" &&
    options.repositoryStatus !== "unavailable"
  ) {
    return null;
  }
  return options.activeSpecWorkspacePath;
}
