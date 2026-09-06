import type { WorktreeId } from "@/features/workspace/domain/worktree";

/**
 * Resolves the workspace path whose Specs should be loaded.
 *
 * Worktree IDs come from the backend's canonical worktree paths, so an active
 * worktree takes precedence over the repository root originally opened.
 *
 * @param openedWorkspacePath - Repository root opened by the workspace loader.
 * @param activeWorktreeId - Canonical path of the selected worktree.
 * @returns The selected worktree path, repository root fallback, or null.
 */
export function resolveActiveWorktreePath(
  openedWorkspacePath: string | null,
  activeWorktreeId: WorktreeId | null,
): string | null {
  return activeWorktreeId ?? openedWorkspacePath;
}
