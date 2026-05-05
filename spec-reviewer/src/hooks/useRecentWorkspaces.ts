import { useCallback, useState } from "react";

import {
  clearStoredRecentWorkspaces,
  readRecentWorkspaces,
  recordRecentWorkspace,
  removeRecentWorkspace,
  type RecentWorkspace,
  type RecentWorkspaceStorage,
  writeRecentWorkspaces,
} from "../lib/recentWorkspaces";

export type UseRecentWorkspacesOptions = Readonly<{
  storage?: RecentWorkspaceStorage | null;
}>;

export type UseRecentWorkspacesResult = Readonly<{
  recentWorkspaces: readonly RecentWorkspace[];
  recordWorkspace: (path: string) => void;
  removeWorkspace: (path: string) => void;
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

  const recordWorkspace = useCallback(
    (path: string): void => {
      setRecentWorkspaces((currentWorkspaces) => {
        const nextWorkspaces = recordRecentWorkspace(currentWorkspaces, path);
        writeRecentWorkspaces(nextWorkspaces, storage);
        return nextWorkspaces;
      });
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
    },
    [storage],
  );

  const clearWorkspaces = useCallback((): void => {
    setRecentWorkspaces([]);
    clearStoredRecentWorkspaces(storage);
  }, [storage]);

  return {
    recentWorkspaces,
    recordWorkspace,
    removeWorkspace,
    clearWorkspaces,
  };
}
