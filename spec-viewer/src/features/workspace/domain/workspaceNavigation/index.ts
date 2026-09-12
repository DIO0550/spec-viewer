import {
  NavigationHistory,
  NavigationHistoryKey,
} from "@/features/workspace/domain/navigationHistory";
import type { WorktreeId } from "@/features/workspace/domain/worktree";
import type { ViewMode } from "@/features/workspace/types/viewMode";

export type WorkspaceNavigation = Readonly<{
  workspaceId: string | null;
  activeWorktreeId: WorktreeId | null;
  mode: ViewMode;
  selectedItemId: string | null;
  selectedItemIdBySelectionKey: NavigationHistory<string | null>;
}>;

export const WorkspaceNavigation = {
  /** @returns A fresh session navigation with no selected workspace. */
  create(): WorkspaceNavigation {
    return {
      workspaceId: null,
      activeWorktreeId: null,
      mode: "specs",
      selectedItemId: null,
      selectedItemIdBySelectionKey: NavigationHistory.empty<string | null>(),
    };
  },
  /**
   * @param state - Current navigation and selection history.
   * @param worktreeId - Worktree whose saved selection should be restored.
   * @returns The selected worktree, or the same state without a workspace.
   */
  selectWorktree(
    state: WorkspaceNavigation,
    worktreeId: WorktreeId,
  ): WorkspaceNavigation {
    if (state.workspaceId === null) {
      return state;
    }

    return {
      ...state,
      activeWorktreeId: worktreeId,
      selectedItemId:
        NavigationHistory.get(
          state.selectedItemIdBySelectionKey,
          NavigationHistoryKey.create({
            workspaceId: state.workspaceId,
            worktreeId,
            mode: state.mode,
          }),
        ) ?? null,
    };
  },
  /**
   * @param state - Current navigation and selection history.
   * @param mode - Mode whose saved selection should be restored.
   * @returns Navigation in the chosen mode, without validating item availability.
   */
  selectMode(state: WorkspaceNavigation, mode: ViewMode): WorkspaceNavigation {
    if (state.workspaceId === null || state.activeWorktreeId === null) {
      return { ...state, mode, selectedItemId: null };
    }

    return {
      ...state,
      mode,
      selectedItemId:
        NavigationHistory.get(
          state.selectedItemIdBySelectionKey,
          NavigationHistoryKey.create({
            workspaceId: state.workspaceId,
            worktreeId: state.activeWorktreeId,
            mode,
          }),
        ) ?? null,
    };
  },
  /**
   * @param state - Navigation identifying the history entry to update.
   * @param itemId - Item to remember, or null to clear its selection.
   * @returns Navigation with the selection saved when a workspace/worktree is active.
   */
  selectItem(
    state: WorkspaceNavigation,
    itemId: string | null,
  ): WorkspaceNavigation {
    if (state.workspaceId === null || state.activeWorktreeId === null) {
      return { ...state, selectedItemId: itemId };
    }

    const key = NavigationHistoryKey.create({
      workspaceId: state.workspaceId,
      worktreeId: state.activeWorktreeId,
      mode: state.mode,
    });

    return {
      ...state,
      selectedItemId: itemId,
      selectedItemIdBySelectionKey: NavigationHistory.set(
        state.selectedItemIdBySelectionKey,
        key,
        itemId,
      ),
    };
  },
  /**
   * @param state - Navigation before the workspace became unavailable.
   * @returns Cleared workspace selection with the session mode and history retained.
   */
  clearWorkspace(state: WorkspaceNavigation): WorkspaceNavigation {
    return {
      ...state,
      workspaceId: null,
      activeWorktreeId: null,
      selectedItemId: null,
    };
  },
};
