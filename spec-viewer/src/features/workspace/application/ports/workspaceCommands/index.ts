import type { Workspace } from "@/features/workspace/domain/workspace";
import type { ValidateWorkspaceDirectoryResponse } from "@/features/workspace/types/workspace";

export type LoadWorkspace = (selectedDirectory: string) => Promise<Workspace>;

export type WorkspaceLoaderCommands = Readonly<{
  /** Opens the native workspace directory picker. */
  selectWorkspaceDirectory: () => Promise<string | null>;
  /**
   * Validates a workspace directory.
   * @param path - Candidate workspace path.
   */
  validateWorkspaceDirectory: (
    path: string,
  ) => Promise<ValidateWorkspaceDirectoryResponse>;
}>;
