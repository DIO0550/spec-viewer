import { useCallback, useEffect, useReducer, useRef } from "react";

import { createGeneration, type GenerationToken } from "@/domains/generation";
import {
  RepositoryDiffOverview,
  type RepositoryIgnoredCursor,
  type RepositoryNodeId,
  type RepositoryWorktreeId,
} from "@/features/diff/domain/repositoryDiff";
import { RepositoryDiffFailure } from "@/features/diff/domain/repositoryDiffFailure";
import {
  createInitialRepositoryDiffState,
  REPOSITORY_DIFF_REFRESH_DEBOUNCE_MS,
  type RepositoryDiffRequestIdentity,
  type RepositoryDiffState,
  reduceRepositoryDiffState,
  shouldStartOverview,
} from "@/features/diff/domain/repositoryDiffState";
import { type RepositoryCommands, repositoryCommands } from "@/lib/api/tauri";

export type UseRepositoryDiffWorkspaceOptions = Readonly<{
  worktreeId: RepositoryWorktreeId | null;
  /**
   * Omitting the field, `undefined` and `null` all mean "no override". The
   * hook normalizes to `null` before the value reaches the request identity,
   * which is compared with `!==`.
   */
  baseOverride?: string | null;
  /** Injectable for tests; defaults to the real IPC commands. */
  commands?: RepositoryCommands;
}>;

export type UseRepositoryDiffWorkspaceResult = Readonly<{
  state: RepositoryDiffState;
  /** Requests a refetch, coalesced through the debounce window. */
  refresh: () => void;
  /** Entry point for external change notifications. */
  notifyExternalChange: () => void;
  /**
   * Expands one deferred ignored directory.
   *
   * @param nodeId - Node to expand.
   * @param cursor - Cursor for the next page, or null for the first page.
   */
  expandIgnoredDirectory: (
    nodeId: RepositoryNodeId,
    cursor: RepositoryIgnoredCursor | null,
  ) => void;
  /**
   * Loads the review for one repository-relative path.
   *
   * @param path - Path to review.
   */
  selectFile: (path: string) => void;
}>;

/**
 * Wires repository-wide diff retrieval to the pure state machine.
 *
 * Stale results are discarded by generation token alone: a Tauri `invoke`
 * cannot be cancelled, so there is nothing for a cancellation signal to abort.
 *
 * @param options - Worktree identity, optional base override and injectable IPC commands.
 * @returns The current state plus the four command callbacks.
 */
export function useRepositoryDiffWorkspace(
  options: UseRepositoryDiffWorkspaceOptions,
): UseRepositoryDiffWorkspaceResult {
  const [state, dispatch] = useReducer(
    reduceRepositoryDiffState,
    undefined,
    createInitialRepositoryDiffState,
  );
  const generationRef = useRef(createGeneration());
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const stateRef = useRef(state);

  const { worktreeId } = options;
  const baseOverride = options.baseOverride ?? null;
  const commands = options.commands ?? repositoryCommands;

  stateRef.current = state;

  const loadOverview = useCallback(
    async (target: RepositoryWorktreeId): Promise<void> => {
      generationRef.current.invalidate();
      const token = generationRef.current.next();
      const identity: RepositoryDiffRequestIdentity = {
        worktreeId: target,
        baseOverride,
        generation: token,
      };
      dispatch({ type: "overviewStarted", ...identity });

      try {
        const overview = await commands.loadOverview({
          worktreeId: target,
          baseOverride,
        });
        if (!mountedRef.current || !generationRef.current.isCurrent(token)) {
          return;
        }
        dispatch({ type: "overviewSucceeded", ...identity, overview });
      } catch (error) {
        if (!mountedRef.current || !generationRef.current.isCurrent(token)) {
          return;
        }
        dispatch({
          type: "overviewFailed",
          ...identity,
          failure: RepositoryDiffFailure.fromCommandError(error),
        });
      }
    },
    [baseOverride, commands],
  );

  const scheduleDebounce = useCallback((): void => {
    dispatch({ type: "externalChangeDetected", at: Date.now() });
    if (debounceTimerRef.current !== null) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null;
      dispatch({ type: "debounceElapsed", at: Date.now() });
    }, REPOSITORY_DIFF_REFRESH_DEBOUNCE_MS);
  }, []);

  useEffect(() => {
    if (worktreeId === null) {
      generationRef.current.invalidate();
      dispatch({ type: "worktreeCleared" });
      return;
    }

    void loadOverview(worktreeId);
  }, [loadOverview, worktreeId]);

  useEffect(() => {
    if (worktreeId === null || !shouldStartOverview(state)) {
      return;
    }

    void loadOverview(worktreeId);
  }, [loadOverview, state, worktreeId]);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      generationRef.current.invalidate();
      if (debounceTimerRef.current !== null) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, []);

  const expandIgnoredDirectory = useCallback(
    (
      nodeId: RepositoryNodeId,
      cursor: RepositoryIgnoredCursor | null,
    ): void => {
      const scope = createSnapshotScope(stateRef.current);
      if (scope === null) {
        return;
      }

      dispatch({
        type: "directoryExpansionStarted",
        ...scope,
        nodeId,
        cursor,
      });
      void commands
        .traverseIgnored({
          worktreeId: scope.worktreeId,
          currentSnapshotId: scope.snapshotId,
          nodeId,
          cursor,
        })
        .then((page) => {
          if (!mountedRef.current) {
            return;
          }
          dispatch({ type: "directoryExpansionSucceeded", ...scope, page });
        })
        .catch((error: unknown) => {
          if (!mountedRef.current) {
            return;
          }
          dispatch({
            type: "directoryExpansionFailed",
            ...scope,
            nodeId,
            failure: RepositoryDiffFailure.fromCommandError(error),
          });
        });
    },
    [commands],
  );

  const selectFile = useCallback(
    (path: string): void => {
      const scope = createSnapshotScope(stateRef.current);
      if (scope === null) {
        return;
      }

      dispatch({ type: "fileReviewStarted", ...scope, path });
      void commands
        .loadFile({
          worktreeId: scope.worktreeId,
          currentSnapshotId: scope.snapshotId,
          path,
        })
        .then((review) => {
          if (!mountedRef.current) {
            return;
          }
          dispatch({ type: "fileReviewSucceeded", ...scope, path, review });
        })
        .catch((error: unknown) => {
          if (!mountedRef.current) {
            return;
          }
          dispatch({
            type: "fileReviewFailed",
            ...scope,
            path,
            failure: RepositoryDiffFailure.fromCommandError(error),
          });
        });
    },
    [commands],
  );

  return {
    state,
    refresh: scheduleDebounce,
    notifyExternalChange: scheduleDebounce,
    expandIgnoredDirectory,
    selectFile,
  };
}

type SnapshotScope = RepositoryDiffRequestIdentity &
  Readonly<{
    snapshotId: NonNullable<RepositoryDiffOverview["currentSnapshotId"]>;
  }>;

/**
 * Builds the identity a snapshot-scoped request must carry, or null when the
 * current snapshot cannot be used (no overview yet, or the base override was
 * rejected so no snapshot exists).
 *
 * @param state - Current reducer state.
 * @returns The scope for a snapshot-bound request, or null to skip it.
 */
function createSnapshotScope(state: RepositoryDiffState): SnapshotScope | null {
  if (
    state.status !== "loaded" ||
    !RepositoryDiffOverview.isSnapshotUsable(state.overview) ||
    state.overview.currentSnapshotId === null
  ) {
    return null;
  }

  return {
    worktreeId: state.worktreeId,
    baseOverride: state.baseOverride,
    generation: state.generation as GenerationToken,
    snapshotId: state.overview.currentSnapshotId,
  };
}
