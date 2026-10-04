import type {
  WorkspaceCommands,
  WorkspaceLoadCommands,
} from "../application/workspaceCommands";
import { WorkspaceError } from "../domain/workspaceError";

export const workspaceCommandFixtures: WorkspaceCommands = {
  loadWorkspace: async (root) => ({
    root,
    kind: "plugin-workspace",
    files: [],
  }),
  selectWorkspaceDirectory: async () => null,
  validateWorkspaceDirectory: async () => ({ isDirectory: true }),
  listWorktrees: async (workspaceId) => ({ workspaceId, worktrees: [] }),
  toWorkspaceError: (error) => {
    const message = error instanceof Error ? error.message : String(error);
    return WorkspaceError.fromCommand({
      command: "load_workspace",
      code: "unknown",
      message,
      raw: error,
    });
  },
  getValidationErrorMessage: (error) =>
    error instanceof Error ? error.message : String(error),
};

export const workspaceLoadFixtures: WorkspaceLoadCommands =
  workspaceCommandFixtures;
