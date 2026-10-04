import type { WorkspaceCommands } from "../../application/workspaceCommands";
import { WorkspaceError } from "../../domain/workspaceError";
import { listWorktrees } from "./listWorktrees";
import { loadWorkspace, LoadWorkspaceCommandError } from "./loadWorkspace";
import { selectWorkspaceDirectory } from "./selectWorkspaceDirectory";
import {
  validateWorkspaceDirectory,
  ValidateWorkspaceDirectoryCommandError,
} from "./validateWorkspaceDirectory";

/** Platform implementation injected into workspace presentation at composition. */
export const tauriWorkspaceCommands: WorkspaceCommands = {
  loadWorkspace,
  listWorktrees,
  selectWorkspaceDirectory,
  validateWorkspaceDirectory,
  toWorkspaceError: (error) =>
    WorkspaceError.fromCommand(LoadWorkspaceCommandError.fromUnknown(error)),
  getValidationErrorMessage: (error) =>
    ValidateWorkspaceDirectoryCommandError.fromUnknown(error).message,
};
