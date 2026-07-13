import { useCallback, useState } from "react";
import type { Workspace } from "@/features/workspace/domain/workspace";
import {
  WorkspacePath,
  type WorkspacePath as WorkspacePathValue,
} from "@/features/workspace/domain/workspacePath";
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
} from "@/features/workspace/infrastructure/recentWorkspaces";

export type UseRecentWorkspacesOptions = Readonly<{
  storage?: RecentWorkspaceStorage | null;
}>;

export type UseRecentWorkspacesResult = Readonly<{
  recentWorkspaces: readonly RecentWorkspace[];
  lastActiveWorkspacePath: WorkspacePathValue | null;
  /** @param workspace - 最近使用した一覧へ記録するワークスペース。 */
  recordWorkspace: (workspace: Workspace) => void;
  /** @param path - 一覧から削除するワークスペースのパス。 */
  removeWorkspace: (path: WorkspacePathValue) => void;
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
  const [lastActiveWorkspacePath, setLastActiveWorkspacePath] =
    useState<WorkspacePathValue | null>(() =>
      readLastActiveWorkspacePath(storage),
    );

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
    (path: WorkspacePathValue): void => {
      setRecentWorkspaces((currentWorkspaces) => {
        const nextWorkspaces = removeRecentWorkspace(currentWorkspaces, path);
        writeRecentWorkspaces(nextWorkspaces, storage);
        return nextWorkspaces;
      });
      setLastActiveWorkspacePath((currentPath) => {
        if (currentPath === null || !WorkspacePath.equals(currentPath, path)) {
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
