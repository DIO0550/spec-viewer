import { WorkspaceNavigation } from "@/features/workspace/domain/workspaceNavigation";
import type { WorktreeId } from "@/features/workspace/domain/worktree";
import { WorkspaceNavigationService } from "@/features/workspace/services/workspaceNavigationService";
import type { ViewMode } from "@/features/workspace/types/viewMode";
import type { WorkspaceWorktreesLoadState } from "@/features/workspace/types/workspaceWorktreesLoadState";

export type NavigationAction =
  | Readonly<{ type: "worktreesUpdated"; source: WorkspaceWorktreesLoadState }>
  | Readonly<{ type: "worktreeSelected"; worktreeId: WorktreeId }>
  | Readonly<{ type: "modeChanged"; mode: ViewMode }>
  | Readonly<{ type: "itemSelected"; itemId: string | null }>;

/**
 * @param state - Current session navigation.
 * @param action - Hook event to translate into a navigation operation.
 * @returns The next navigation state.
 */
export function navigationReducer(
  state: WorkspaceNavigation,
  action: NavigationAction,
): WorkspaceNavigation {
  switch (action.type) {
    case "worktreesUpdated":
      if (action.source.status === "unavailable") {
        return WorkspaceNavigation.clearWorkspace(state);
      }
      return WorkspaceNavigationService.reconcileWithWorktrees(
        state,
        action.source.data,
      );
    case "worktreeSelected":
      return WorkspaceNavigation.selectWorktree(state, action.worktreeId);
    case "modeChanged":
      return WorkspaceNavigation.selectMode(state, action.mode);
    case "itemSelected":
      return WorkspaceNavigation.selectItem(state, action.itemId);
    default:
      return action satisfies never;
  }
}
