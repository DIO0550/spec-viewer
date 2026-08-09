import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import {
  loadRepositoryDiff,
  loadRepositoryFile,
  traverseRepositoryIgnored,
  type LoadRepositoryDiffRequest,
  type LoadRepositoryFileRequest,
  type TraverseRepositoryIgnoredRequest,
} from "@/lib/api/tauri";
import type {
  IgnoredPage,
  RepositoryDiffOverview,
  RepositoryDiffSelection,
  RepositoryFileReview,
} from "@/features/repositoryDiff/domain/repositoryDiff";
import {
  createInitialRepositoryDiffWorkspaceState,
  repositoryDiffWorkspaceReducer,
  type RepositoryDiffDetailIdentity,
  type RepositoryDiffIgnoredPageIdentity,
  type RepositoryDiffRequestIdentity,
  type RepositoryDiffWorkspaceState,
} from "@/features/repositoryDiff/domain/repositoryDiffWorkspaceState";
import {
  normalizeRepositoryDiffFileFailure,
  normalizeRepositoryDiffIgnoredPageFailure,
  normalizeRepositoryDiffOverviewFailure,
} from "@/features/repositoryDiff/services/repositoryDiffFailure";

export type RepositoryDiffWorkspaceApi = Readonly<{
  loadRepositoryDiff: (
    request: LoadRepositoryDiffRequest,
  ) => Promise<RepositoryDiffOverview>;
  loadRepositoryFile: (
    request: LoadRepositoryFileRequest,
  ) => Promise<RepositoryFileReview>;
  traverseRepositoryIgnored: (
    request: TraverseRepositoryIgnoredRequest,
  ) => Promise<IgnoredPage>;
}>;

export type UseRepositoryDiffWorkspaceOptions = Readonly<{
  workspacePath: string | null;
  worktreeId: string | null;
  baseOverride?: string | null;
  selection?: RepositoryDiffSelection | null;
  api?: RepositoryDiffWorkspaceApi;
}>;

export type UseRepositoryDiffWorkspaceResult = Readonly<{
  state: RepositoryDiffWorkspaceState;
  selection: RepositoryDiffSelection | null;
  baseOverride: string | null;
  refresh: () => Promise<boolean>;
  selectPath: (path: string) => Promise<boolean>;
  selectBaseOverride: (baseOverride: string | null) => Promise<boolean>;
  loadIgnoredChildren: (
    nodeId: string,
    cursor?: string | null,
  ) => Promise<boolean>;
  retry: () => Promise<boolean>;
  invalidate: () => void;
}>;

const DEFAULT_API: RepositoryDiffWorkspaceApi = {
  loadRepositoryDiff,
  loadRepositoryFile,
  traverseRepositoryIgnored,
};

const STALE_DETAIL_ERROR_CODES = new Set([
  "staleSnapshot",
  "staleBase",
  "entryChangedDuringRead",
  "headChangedDuringRead",
]);

/**
 * @param request - Repository request identity.
 * @returns The backend overview request for the current base override.
 */
const createOverviewRequest = (
  request: RepositoryDiffRequestIdentity,
): LoadRepositoryDiffRequest =>
  request.baseOverride === null
    ? { worktreeId: request.worktreeId }
    : { worktreeId: request.worktreeId, baseOverride: request.baseOverride };

/** Coordinates repository overview, file detail, and deferred ignored pages. */
export function useRepositoryDiffWorkspace({
  workspacePath,
  worktreeId,
  baseOverride = null,
  selection: requestedSelection = null,
  api = DEFAULT_API,
}: UseRepositoryDiffWorkspaceOptions): UseRepositoryDiffWorkspaceResult {
  const [state, dispatch] = useReducer(
    repositoryDiffWorkspaceReducer,
    undefined,
    createInitialRepositoryDiffWorkspaceState,
  );
  const [selection, setSelection] = useState<RepositoryDiffSelection | null>(
    requestedSelection,
  );
  const [activeBaseOverride, setActiveBaseOverride] = useState<string | null>(
    baseOverride,
  );
  const mountedRef = useRef(true);
  const workspacePathRef = useRef(workspacePath);
  const worktreeIdRef = useRef(worktreeId);
  const baseOverrideRef = useRef<string | null>(baseOverride);
  const requestedBaseOverrideRef = useRef<string | null>(baseOverride);
  const selectionRef = useRef<RepositoryDiffSelection | null>(
    requestedSelection,
  );
  const stateRef = useRef(state);
  const cycleIdRef = useRef(0);
  const requestGenerationRef = useRef(0);
  const detailGenerationRef = useRef(0);
  const ignoredPageGenerationRef = useRef(new Map<string, number>());
  const refreshDrainRef = useRef<Promise<boolean> | null>(null);
  const refreshPendingRef = useRef(false);

  workspacePathRef.current = workspacePath;
  worktreeIdRef.current = worktreeId;
  stateRef.current = state;
  selectionRef.current = selection;
  baseOverrideRef.current = activeBaseOverride;

  const isActive = useCallback(
    (request: RepositoryDiffRequestIdentity): boolean => {
      return (
        mountedRef.current &&
        workspacePathRef.current === request.workspacePath &&
        worktreeIdRef.current === request.worktreeId &&
        baseOverrideRef.current === request.baseOverride &&
        requestGenerationRef.current === request.requestGeneration
      );
    },
    [],
  );

  const invalidate = useCallback((): void => {
    requestGenerationRef.current += 1;
    detailGenerationRef.current += 1;
    ignoredPageGenerationRef.current.clear();
    dispatch({ type: "reset" });
  }, []);

  const loadDetail = useCallback(
    async (
      request: RepositoryDiffRequestIdentity,
      overview: RepositoryDiffOverview,
      requested: RepositoryDiffSelection | null,
      allowStaleRecovery: boolean,
      recoverOverview: () => Promise<boolean>,
    ): Promise<boolean> => {
      const snapshotId = overview.currentSnapshotId;
      if (
        requested === null ||
        snapshotId === null ||
        requested.worktreeId !== request.worktreeId
      ) {
        return true;
      }

      const detailSelection: RepositoryDiffSelection = {
        ...requested,
        snapshotId,
      };
      selectionRef.current = detailSelection;
      setSelection(detailSelection);
      const detailGeneration = detailGenerationRef.current + 1;
      detailGenerationRef.current = detailGeneration;
      const identity: RepositoryDiffDetailIdentity = {
        request,
        snapshotId,
        path: detailSelection.path,
        detailGeneration,
      };
      dispatch({ type: "detailRequested", identity });

      try {
        const review = await api.loadRepositoryFile({
          worktreeId: request.worktreeId,
          currentSnapshotId: snapshotId,
          path: detailSelection.path,
        });
        if (
          !isActive(request) ||
          detailGenerationRef.current !== detailGeneration
        ) {
          return false;
        }
        dispatch({ type: "detailSucceeded", identity, review });
        return true;
      } catch (error) {
        const failure = normalizeRepositoryDiffFileFailure(error);
        if (
          !isActive(request) ||
          detailGenerationRef.current !== detailGeneration
        ) {
          return false;
        }
        if (allowStaleRecovery && STALE_DETAIL_ERROR_CODES.has(failure.code)) {
          return recoverOverview();
        }
        dispatch({ type: "detailFailed", identity, error: failure });
        return false;
      }
    },
    [api, isActive],
  );

  const executeOverview = useCallback(
    async (cycleId: number, allowStaleRecovery: boolean): Promise<boolean> => {
      const activeWorkspacePath = workspacePathRef.current;
      const activeWorktreeId = worktreeIdRef.current;
      if (
        activeWorkspacePath === null ||
        activeWorktreeId === null ||
        !mountedRef.current
      ) {
        return false;
      }

      detailGenerationRef.current += 1;
      ignoredPageGenerationRef.current.clear();
      const requestGeneration = requestGenerationRef.current + 1;
      requestGenerationRef.current = requestGeneration;
      const request: RepositoryDiffRequestIdentity = {
        workspacePath: activeWorkspacePath,
        worktreeId: activeWorktreeId,
        baseOverride: baseOverrideRef.current,
        cycleId,
        requestGeneration,
      };
      dispatch({ type: "overviewRequested", request });

      try {
        const overview = await api.loadRepositoryDiff(
          createOverviewRequest(request),
        );
        if (!isActive(request)) {
          return false;
        }
        dispatch({ type: "overviewSucceeded", request, overview });
        return loadDetail(
          request,
          overview,
          selectionRef.current,
          allowStaleRecovery,
          () => executeOverview(cycleId, false),
        );
      } catch (error) {
        const failure = normalizeRepositoryDiffOverviewFailure(error);
        if (!isActive(request)) {
          return false;
        }
        dispatch({ type: "overviewFailed", request, error: failure });
        return false;
      }
    },
    [api, isActive, loadDetail],
  );

  const refresh = useCallback((): Promise<boolean> => {
    if (
      workspacePathRef.current === null ||
      worktreeIdRef.current === null ||
      !mountedRef.current
    ) {
      invalidate();
      return Promise.resolve(false);
    }

    if (refreshDrainRef.current !== null) {
      refreshPendingRef.current = true;
      return refreshDrainRef.current;
    }

    const drain = async (): Promise<boolean> => {
      let result = false;
      do {
        refreshPendingRef.current = false;
        cycleIdRef.current += 1;
        result = await executeOverview(cycleIdRef.current, true);
      } while (mountedRef.current && refreshPendingRef.current);
      return result;
    };
    const promise = drain();
    const trackedPromise = promise.finally(() => {
      if (refreshDrainRef.current === trackedPromise) {
        refreshDrainRef.current = null;
      }
    });
    refreshDrainRef.current = trackedPromise;
    return trackedPromise;
  }, [executeOverview, invalidate]);

  const selectPath = useCallback(
    async (path: string): Promise<boolean> => {
      const currentState = stateRef.current;
      if (
        currentState.status !== "ready" ||
        currentState.request === null ||
        currentState.overview === null ||
        currentState.overview.currentSnapshotId === null ||
        path.length === 0
      ) {
        return false;
      }
      const nextSelection: RepositoryDiffSelection = {
        worktreeId: currentState.request.worktreeId,
        snapshotId: currentState.overview.currentSnapshotId,
        path,
      };
      selectionRef.current = nextSelection;
      setSelection(nextSelection);
      return loadDetail(
        currentState.request,
        currentState.overview,
        nextSelection,
        false,
        async () => false,
      );
    },
    [loadDetail],
  );

  const selectBaseOverride = useCallback(
    async (nextBaseOverride: string | null): Promise<boolean> => {
      if (workspacePathRef.current === null || worktreeIdRef.current === null) {
        return false;
      }
      const normalized = nextBaseOverride === null ? null : nextBaseOverride;
      baseOverrideRef.current = normalized;
      setActiveBaseOverride(normalized);
      invalidate();
      return refresh();
    },
    [invalidate, refresh],
  );

  const loadIgnoredChildren = useCallback(
    async (
      nodeId: string,
      requestedCursor?: string | null,
    ): Promise<boolean> => {
      const currentState = stateRef.current;
      const request = currentState.request;
      const snapshotId = currentState.overview?.currentSnapshotId ?? null;
      if (
        currentState.status !== "ready" ||
        request === null ||
        snapshotId === null ||
        nodeId.length === 0
      ) {
        return false;
      }
      const previousPage = currentState.ignoredPages[nodeId];
      const cursor =
        requestedCursor === undefined
          ? (previousPage?.nextCursor ?? null)
          : requestedCursor;
      const currentGeneration =
        ignoredPageGenerationRef.current.get(nodeId) ?? 0;
      const pageGeneration = currentGeneration + 1;
      ignoredPageGenerationRef.current.set(nodeId, pageGeneration);
      const identity: RepositoryDiffIgnoredPageIdentity = {
        request,
        snapshotId,
        nodeId,
        cursor,
        pageGeneration,
      };
      dispatch({ type: "ignoredPageRequested", identity });

      try {
        const requestPayload: TraverseRepositoryIgnoredRequest =
          cursor === null
            ? {
                worktreeId: request.worktreeId,
                currentSnapshotId: snapshotId,
                nodeId,
              }
            : {
                worktreeId: request.worktreeId,
                currentSnapshotId: snapshotId,
                nodeId,
                cursor,
              };
        const response = await api.traverseRepositoryIgnored(requestPayload);
        if (
          !isActive(request) ||
          ignoredPageGenerationRef.current.get(nodeId) !== pageGeneration
        ) {
          return false;
        }
        dispatch({ type: "ignoredPageSucceeded", identity, page: response });
        return true;
      } catch (error) {
        const failure = normalizeRepositoryDiffIgnoredPageFailure(error);
        if (
          !isActive(request) ||
          ignoredPageGenerationRef.current.get(nodeId) !== pageGeneration
        ) {
          return false;
        }
        dispatch({ type: "ignoredPageFailed", identity, error: failure });
        return false;
      }
    },
    [api, isActive],
  );

  const retry = useCallback((): Promise<boolean> => refresh(), [refresh]);

  useEffect(() => {
    const nextBaseOverride = baseOverride ?? null;
    const previousBaseOverride = requestedBaseOverrideRef.current;
    requestedBaseOverrideRef.current = nextBaseOverride;
    workspacePathRef.current = workspacePath;
    worktreeIdRef.current = worktreeId;
    if (previousBaseOverride !== nextBaseOverride) {
      baseOverrideRef.current = nextBaseOverride;
      setActiveBaseOverride(nextBaseOverride);
    }
    selectionRef.current =
      requestedSelection !== null &&
      worktreeId !== null &&
      requestedSelection.worktreeId === worktreeId
        ? requestedSelection
        : null;
    setSelection(selectionRef.current);
    invalidate();
    if (workspacePath === null || worktreeId === null) {
      return;
    }
    void refresh();
  }, [
    baseOverride,
    invalidate,
    refresh,
    requestedSelection,
    workspacePath,
    worktreeId,
  ]);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      requestGenerationRef.current += 1;
      detailGenerationRef.current += 1;
      ignoredPageGenerationRef.current.clear();
      refreshPendingRef.current = false;
    };
  }, []);

  return {
    state,
    selection,
    baseOverride: activeBaseOverride,
    refresh,
    selectPath,
    selectBaseOverride,
    loadIgnoredChildren,
    retry,
    invalidate,
  };
}
