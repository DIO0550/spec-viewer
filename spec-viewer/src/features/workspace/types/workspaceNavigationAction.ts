import type { WorktreeId } from "@/features/workspace/domain/worktree";
import type { ViewMode } from "./viewMode";
import type { WorkspaceWorktreesLoadState } from "./workspaceWorktreesLoadState";

export type WorkspaceNavigationAction =
  | Readonly<{ type: "sourceChanged"; source: WorkspaceWorktreesLoadState }>
  | Readonly<{ type: "worktreeSelected"; worktreeId: WorktreeId }>
  | Readonly<{ type: "modeChanged"; mode: ViewMode }>
  | Readonly<{ type: "itemSelected"; itemId: string | null }>;
