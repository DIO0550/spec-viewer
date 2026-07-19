import { useCallback, useState } from "react";
import type { Workspace } from "@/features/workspace/types/workspace";
import {
  clearLastActiveWorkspacePath,
  clearStoredRecentWorkspaces,
  type RecentWorkspaceStorage,
  readLastActiveWorkspacePath,
  readRecentWorkspaces,
  writeLastActiveWorkspacePath,
  writeRecentWorkspaces,
} from "@/lib/recentWorkspaces";
import {
  recordRecentWorkspace,
  removeRecentWorkspace,
  type RecentWorkspace,
} from "@/utils/recentWorkspaces";

export type UseRecentWorkspacesOptions = Readonly<{
  storage?: RecentWorkspaceStorage | null;
}>;

export type UseRecentWorkspacesResult = Readonly<{
  recentWorkspaces: readonly RecentWorkspace[];
  lastActiveWorkspacePath: string | null;
  /** @param workspace - 最近使用した一覧へ記録するワークスペース。 */
  recordWorkspace: (workspace: Workspace) => void;
  /** @param path - 一覧から削除するワークスペースのパス。 */
  removeWorkspace: (path: string) => void;
  /** 最近使用したワークスペースをすべて消去する。 */
  clearWorkspaces: () => void;
}>;

/** @returns Recent workspace state synchronized with local browser storage. */
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
