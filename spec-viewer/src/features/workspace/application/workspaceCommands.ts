import type { Workspace } from "../domain/workspace";
import type { WorkspaceDropIntent } from "../domain/workspaceDropIntent";
import type { WorkspaceError } from "../domain/workspaceError";
import type { WorkspaceWorktrees } from "../domain/worktree";

/** Operations needed to open a workspace, independent of the platform adapter. */
export type WorkspaceLoadCommands = Readonly<{
  loadWorkspace: (selectedDirectory: string) => Promise<Workspace>;
  toWorkspaceError: (error: unknown) => WorkspaceError;
}>;

/** Directory picker and validation operations used by the workspace loader. */
export type WorkspaceLoaderCommands = Readonly<{
  selectWorkspaceDirectory: () => Promise<string | null>;
  validateWorkspaceDirectory: (
    path: string,
  ) => Promise<Readonly<{ isDirectory: boolean }>>;
  getValidationErrorMessage: (error: unknown) => string;
}>;

/** Worktree query used by workspace navigation. */
export type WorkspaceWorktreeCommands = Readonly<{
  listWorktrees: (workspacePath: string) => Promise<WorkspaceWorktrees>;
}>;

export type SubscribeWorkspaceDragDropEvents = (
  handler: (event: WorkspaceDropIntent) => void,
) => Promise<() => void>;

export type WorkspaceCommands = WorkspaceLoadCommands &
  WorkspaceLoaderCommands &
  WorkspaceWorktreeCommands;
