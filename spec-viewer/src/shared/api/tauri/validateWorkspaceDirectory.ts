import { invokeTauriCommand } from "./invokeTauriCommand";

/** @returns Whether the given path points to an existing directory. */
export async function validateWorkspaceDirectory(
  path: string,
): Promise<Readonly<{ isDirectory: boolean }>> {
  return invokeTauriCommand("validate_workspace_directory", { path });
}
