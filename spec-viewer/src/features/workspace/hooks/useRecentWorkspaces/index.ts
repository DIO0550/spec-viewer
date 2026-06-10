import { useCallback, useState } from "react";
import type { Workspace } from "@/features/workspace/types/workspace";
import {
  clearLastActiveWorkspacePath,
  clearStoredRecentWorkspaces,
  type RecentWorkspace,
  type RecentWorkspaceStorage,
  readLastActiveWorkspacePath,
  readRecentWorkspaces,
  recordRecentWorkspace,
  removeRecentWorkspace,
  writeLastActiveWorkspacePath,
  writeRecentWorkspaces,
} from "@/shared/lib/recentWorkspaces";

export type UseRecentWorkspacesOptions = Readonly<{
  storage?: RecentWorkspaceStorage | null;
}>;

export type UseRecentWorkspacesResult = Readonly<{
  recentWorkspaces: readonly RecentWorkspace[];
  lastActiveWorkspacePath: string | null;
  /**
   * Records a workspace as the most recent entry.
   * @param workspace - The workspace to record.
   */
  recordWorkspace: (workspace: Workspace) => void;
  /**
   * Removes a recent workspace by path.
   * @param path - The workspace path to remove.
   */
  removeWorkspace: (path: string) => void;
  /** Clears all recent workspaces and the last active path. */
  clearWorkspaces: () => void;
}>;

/**
 * @param options - Optional storage override for persisting recent workspaces.
 * @returns Recent workspace state synchronized with local browser storage.
 */
export function useRecentWorkspaces(
  options: UseRecentWorkspacesOptions = {},
): UseRecentWorkspacesResult {
  const storage = "storage" in options ? options.storage : undefined;
  const [recentWorkspaces, setRecentWorkspaces] = useState<
    readonly RecentWorkspace[]
  >(() => readRecentWorkspaces(storage));
  const [lastActiveWorkspacePath, setLastActiveWorkspacePath] = useState<
    string | null
  >(() => readLastActiveWorkspacePath(storage));

  const recordWorkspace = useCallback(
    (workspace: Workspace): void => {
      setRecentWorkspaces((currentWorkspaces) => {
        const nextWorkspaces = recordRecentWorkspace(
          currentWorkspaces,
          workspace,
        );
        writeRecentWorkspaces(nextWorkspaces, storage);
        return nextWorkspaces;
      });
      writeLastActiveWorkspacePath(workspace.root, storage);
      setLastActiveWorkspacePath(readLastActiveWorkspacePath(storage));
    },
    [storage],
  );

  const removeWorkspace = useCallback(
    (path: string): void => {
      setRecentWorkspaces((currentWorkspaces) => {
        const nextWorkspaces = removeRecentWorkspace(currentWorkspaces, path);
        writeRecentWorkspaces(nextWorkspaces, storage);
        return nextWorkspaces;
      });
      setLastActiveWorkspacePath((currentPath) => {
        if (currentPath !== path) {
          return currentPath;
        }

        clearLastActiveWorkspacePath(storage);
        return null;
      });
    },
    [storage],
  );

  const clearWorkspaces = useCallback((): void => {
    setRecentWorkspaces([]);
    setLastActiveWorkspacePath(null);
    clearStoredRecentWorkspaces(storage);
    clearLastActiveWorkspacePath(storage);
  }, [storage]);

  return {
    recentWorkspaces,
    lastActiveWorkspacePath,
    recordWorkspace,
    removeWorkspace,
    clearWorkspaces,
  };
}
