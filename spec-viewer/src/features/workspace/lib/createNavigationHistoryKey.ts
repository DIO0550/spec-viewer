import type { WorktreeId } from "@/features/workspace/domain/worktree";
import type { ViewMode } from "@/features/workspace/types/viewMode";

/**
 * Creates a collision-safe selection history key.
 *
 * @param workspaceId - Stable workspace identity.
 * @param worktreeId - Stable worktree identity.
 * @param mode - Active view mode.
 * @returns Serialized three-part identity.
 */
export function createNavigationHistoryKey(
  workspaceId: string,
  worktreeId: WorktreeId,
  mode: ViewMode,
): string {
  return JSON.stringify([workspaceId, worktreeId, mode]);
}
