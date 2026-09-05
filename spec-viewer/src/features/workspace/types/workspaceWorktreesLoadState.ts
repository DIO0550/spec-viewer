import type { WorkspaceWorktrees } from "@/features/workspace/domain/worktree";

export type WorkspaceWorktreesUnavailableReason =
  | "contract-pending"
  | "data-source-not-connected";

export type WorkspaceWorktreesLoadState =
  | Readonly<{ status: "ready"; data: WorkspaceWorktrees }>
  | Readonly<{
      status: "unavailable";
      reason: WorkspaceWorktreesUnavailableReason;
    }>;
