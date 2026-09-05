import type { Worktree } from "./worktree";

export type WorkspaceId = string;

export type WorkspaceWorktrees = Readonly<{
  workspaceId: WorkspaceId;
  worktrees: readonly Worktree[];
}>;
