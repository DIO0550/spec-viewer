import { WorkspaceNavigation } from "@/features/workspace/domain/workspaceNavigation";
import {
  NavigationHistory,
  NavigationHistoryKey,
} from "@/features/workspace/domain/navigationHistory";
import type { WorkspaceWorktrees } from "@/features/workspace/domain/worktree";

/**
 * @param state - Navigation and saved selections before the snapshot update.
 * @param worktrees - Available worktrees in fallback order.
 * @returns Navigation with an available saved item or the first eligible item.
 */
export function updateNavigationFromWorktrees(
  state: WorkspaceNavigation,
  worktrees: WorkspaceWorktrees,
): WorkspaceNavigation {
  const workspaceId = worktrees.workspaceId;
  const currentWorktree = worktrees.worktrees.find(
    (worktree) =>
      workspaceId === state.workspaceId &&
      worktree.id === state.activeWorktreeId,
  );
  const activeWorktree = currentWorktree ?? worktrees.worktrees[0];
  if (activeWorktree === undefined) {
    return WorkspaceNavigation.selectItem(
      { ...state, workspaceId, activeWorktreeId: null },
      null,
    );
  }

  const activeWorktreeId = activeWorktree.id;
  const navigation = { ...state, workspaceId, activeWorktreeId };
  const key = NavigationHistoryKey.create({
    workspaceId,
    worktreeId: activeWorktreeId,
    mode: state.mode,
  });
  const preferredItemId =
    NavigationHistory.get(state.selectedItemIdBySelectionKey, key) ?? null;

  let availableItemIds: readonly string[];
  if (state.mode === "specs") {
    availableItemIds = activeWorktree.specs
      .filter((spec) => !spec.isArchived)
      .map((spec) => spec.id);
  } else {
    availableItemIds = activeWorktree.changedFiles.map((file) => file.id);
  }

  if (preferredItemId !== null && availableItemIds.includes(preferredItemId)) {
    return WorkspaceNavigation.selectItem(navigation, preferredItemId);
  }

  return WorkspaceNavigation.selectItem(navigation, availableItemIds[0] ?? null);
}
