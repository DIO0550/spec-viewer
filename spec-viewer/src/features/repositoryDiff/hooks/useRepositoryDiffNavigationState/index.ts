import { useCallback, useMemo, useReducer } from "react";

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
    selectPath: (path: string | null) => void;
    toggleDirectory: (path: string) => void;
    reconcile: (
      visiblePaths: readonly string[],
      directoryPaths: readonly string[],
    ) => void;
  }>;
}>;

/**
 * Keeps repository tree navigation in the App session without persistence.
 * Options identify the repository view.
 * Returns the current key-scoped entry and controlled actions.
 */
export function useRepositoryDiffNavigationState(
  options: UseRepositoryDiffNavigationStateOptions,
): UseRepositoryDiffNavigationStateResult {
  const [state, dispatch] = useReducer(
    reduceRepositoryDiffNavigationState,
    undefined,
    createInitialRepositoryDiffNavigationState,
  );
  const key =
    options.workspaceId === null || options.worktreeId === null
      ? null
      : createRepositoryDiffNavigationKey(
          options.workspaceId,
          options.worktreeId,
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
      if (key !== null) {
        dispatch({ type: "filterChanged", key, filter });
      }
    },
    [key],
  );
  const selectPath = useCallback(
    (path: string | null): void => {
      if (key !== null) {
        dispatch({ type: "pathSelected", key, path });
      }
    },
    [key],
  );
  const toggleDirectory = useCallback(
    (path: string): void => {
      if (key !== null) {
        dispatch({ type: "directoryToggled", key, path });
      }
    },
    [key],
  );
  const reconcile = useCallback(
    (
      visiblePaths: readonly string[],
      directoryPaths: readonly string[],
    ): void => {
      if (key !== null) {
        dispatch({
          type: "reconciled",
          key,
          visiblePaths,
          directoryPaths,
        });
      }
    },
    [key],
  );

  return {
    key,
    state,
    entry,
    actions: { changeFilter, selectPath, toggleDirectory, reconcile },
  };
}
