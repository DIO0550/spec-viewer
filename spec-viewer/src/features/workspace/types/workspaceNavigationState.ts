import type { NavigationHistory } from "@/features/workspace/domain/navigationHistory";
import type { WorktreeId } from "@/features/workspace/domain/worktree";
import type { ViewMode } from "./viewMode";

export type WorkspaceNavigationState = Readonly<{
  workspaceId: string | null;
  activeWorktreeId: WorktreeId | null;
  mode: ViewMode;
  selectedItemId: string | null;
  selectedItemIdBySelectionKey: NavigationHistory<string | null>;
}>;
