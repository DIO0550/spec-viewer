import type { WorktreeId } from "@/features/workspace/domain/worktree";
import type { ViewMode } from "./viewMode";

export type WorkspaceNavigationState = Readonly<{
  workspaceId: string | null;
  activeWorktreeId: WorktreeId | null;
  mode: ViewMode;
  selectedItemId: string | null;
  selectedItemIdBySelectionKey: Readonly<Record<string, string | null>>;
}>;
