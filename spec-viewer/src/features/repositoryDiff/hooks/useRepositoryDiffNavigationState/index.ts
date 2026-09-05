import { useCallback, useMemo, useReducer } from "react";

import type { FileReviewViewMode } from "@/features/diff/domain/fileDiff";
import type { RepositoryDiffFilter } from "@/features/repositoryDiff/domain/repositoryDiff";
import {
  createInitialRepositoryDiffNavigationEntry,
  createInitialRepositoryDiffNavigationState,
  type RepositoryDiffNavigationEntry,
  type RepositoryDiffNavigationState,
  reduceRepositoryDiffNavigationState,
} from "@/features/repositoryDiff/domain/repositoryDiffNavigationState";
import { createRepositoryDiffNavigationKey } from "@/features/workspace/lib/createNavigationHistoryKey";

export type UseRepositoryDiffNavigationStateOptions = Readonly<{
  workspaceId: string | null;
  worktreeId: string | null;
}>;

export type UseRepositoryDiffNavigationStateResult = Readonly<{
  key: string | null;
  state: RepositoryDiffNavigationState;
  entry: RepositoryDiffNavigationEntry;
  actions: Readonly<{
    changeFilter: (filter: RepositoryDiffFilter) => void;
    openPath: (path: string) => void;
    activateTab: (path: string) => void;
    closeTab: (path: string) => void;
    changeViewerMode: (mode: FileReviewViewMode) => void;
    changeJumpTarget: (path: string, changeId: string | null) => void;
    toggleDirectory: (path: string) => void;
    reconcile: (
      validFilePaths: readonly string[],
      directoryPaths: readonly string[],
    ) => void;
  }>;
}>;

/**
 * Keeps repository file navigation in the current application session.
 *
 * @param options - Workspace and worktree identity.
 * @returns The key-scoped entry and stable controlled actions.
 */
export function useRepositoryDiffNavigationState(
  options: UseRepositoryDiffNavigationStateOptions,
): UseRepositoryDiffNavigationStateResult {
  const [state, dispatch] = useReducer(
    reduceRepositoryDiffNavigationState,
    undefined,
    createInitialRepositoryDiffNavigationState,
  );
  const key = useMemo(
    () =>
      options.workspaceId === null || options.worktreeId === null
        ? null
        : createRepositoryDiffNavigationKey(
            options.workspaceId,
            options.worktreeId,
          ),
    [options.workspaceId, options.worktreeId],
  );
  const entry = useMemo(
    () =>
      key === null
        ? createInitialRepositoryDiffNavigationEntry()
        : (state.entriesByKey[key] ??
          createInitialRepositoryDiffNavigationEntry()),
    [key, state.entriesByKey],
  );

  const changeFilter = useCallback(
    (filter: RepositoryDiffFilter): void => {
      if (key === null) {
        return;
      }
      dispatch({ type: "filterChanged", key, filter });
    },
    [key],
  );
  const openPath = useCallback(
    (path: string): void => {
      if (key === null) {
        return;
      }
      dispatch({ type: "pathOpened", key, path });
    },
    [key],
  );
  const activateTab = useCallback(
    (path: string): void => {
      if (key === null) {
        return;
      }
      dispatch({ type: "tabActivated", key, path });
    },
    [key],
  );
  const closeTab = useCallback(
    (path: string): void => {
      if (key === null) {
        return;
      }
      dispatch({ type: "tabClosed", key, path });
    },
    [key],
  );
  const changeViewerMode = useCallback(
    (mode: FileReviewViewMode): void => {
      if (key === null) {
        return;
      }
      dispatch({ type: "viewerModeChanged", key, mode });
    },
    [key],
  );
  const changeJumpTarget = useCallback(
    (path: string, changeId: string | null): void => {
      if (key === null) {
        return;
      }
      dispatch({ type: "jumpTargetChanged", key, path, changeId });
    },
    [key],
  );
  const toggleDirectory = useCallback(
    (path: string): void => {
      if (key === null) {
        return;
      }
      dispatch({ type: "directoryToggled", key, path });
    },
    [key],
  );
  const reconcile = useCallback(
    (
      validFilePaths: readonly string[],
      directoryPaths: readonly string[],
    ): void => {
      if (key === null) {
        return;
      }
      dispatch({
        type: "reconciled",
        key,
        validFilePaths,
        directoryPaths,
      });
    },
    [key],
  );

  const actions = useMemo(
    () => ({
      changeFilter,
      openPath,
      activateTab,
      closeTab,
      changeViewerMode,
      changeJumpTarget,
      toggleDirectory,
      reconcile,
    }),
    [
      activateTab,
      changeFilter,
      changeJumpTarget,
      changeViewerMode,
      closeTab,
      openPath,
      reconcile,
      toggleDirectory,
    ],
  );

  return { key, state, entry, actions };
}
