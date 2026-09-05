import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import type {
  IgnoredPage,
  RepositoryDiffOverview,
  RepositoryDiffSelection,
  RepositoryDiffSelectionRequest,
  RepositoryFileReview,
} from "@/features/repositoryDiff/domain/repositoryDiff";
import {
  createInitialRepositoryDiffWorkspaceState,
  type RepositoryDiffDetailIdentity,
  type RepositoryDiffIgnoredPageIdentity,
  type RepositoryDiffRequestIdentity,
  type RepositoryDiffWorkspaceState,
  repositoryDiffWorkspaceReducer,
} from "@/features/repositoryDiff/domain/repositoryDiffWorkspaceState";
import {
  normalizeRepositoryDiffFileFailure,
  normalizeRepositoryDiffIgnoredPageFailure,
  normalizeRepositoryDiffOverviewFailure,
} from "@/features/repositoryDiff/services/repositoryDiffFailure";
import {
  type LoadRepositoryDiffRequest,
  type LoadRepositoryFileRequest,
  loadRepositoryDiff,
  loadRepositoryFile,
  type TraverseRepositoryIgnoredRequest,
  traverseRepositoryIgnored,
} from "@/lib/api/tauri";
import {
  createPerformanceCorrelationId,
  startPerformanceSpan,
} from "@/lib/performance";

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
  selection?: RepositoryDiffSelectionRequest | RepositoryDiffSelection | null;
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

type IgnoredPageQueueItem = Readonly<{
  key: string;
  request: RepositoryDiffRequestIdentity;
  snapshotId: string;
  nodeId: string;
  cursor: string | null;
  resolve: (result: boolean) => void;
}>;

const createIgnoredPageRequestKey = (
  request: RepositoryDiffRequestIdentity,
  snapshotId: string,
  nodeId: string,
  cursor: string | null,
): string =>
  JSON.stringify([
    request.workspacePath,
    request.worktreeId,
    request.baseOverride,
    request.cycleId,
    request.requestGeneration,
    snapshotId,
    nodeId,
    cursor,
  ]);

const STALE_DETAIL_ERROR_CODES = new Set([
  "staleSnapshot",
  "staleBase",
  "entryChangedDuringRead",
  "headChangedDuringRead",
]);
const DETAIL_CACHE_LIMIT = 8;

/**
 * @param worktreeId - Active worktree identity.
 * @param snapshotId - Immutable repository snapshot identity.
 * @param path - Repository-relative file path.
 * @returns A collision-safe key for one file detail response.
 */
function createDetailCacheKey(
  worktreeId: string,
  snapshotId: string,
  path: string,
): string {
  return JSON.stringify([worktreeId, snapshotId, path]);
}

/**
 * Stores a detail as most recently used while keeping the cache bounded.
 *
 * @param cache - Hook-local detail cache.
 * @param key - Snapshot-scoped detail key.
 * @param review - Successfully decoded file review.
 */
function rememberDetail(
  cache: Map<string, RepositoryFileReview>,
  key: string,
  review: RepositoryFileReview,
): void {
  cache.delete(key);
  cache.set(key, review);
  if (cache.size <= DETAIL_CACHE_LIMIT) {
    return;
  }
  const oldestKey = cache.keys().next().value;
  if (oldestKey !== undefined) {
    cache.delete(oldestKey);
  }
}

/**
 * Input accepted by the workspace selection boundary.
 */
type RepositoryDiffSelectionInput =
  | RepositoryDiffSelectionRequest
  | RepositoryDiffSelection;

const isSnapshotSelection = (
  selection: RepositoryDiffSelectionInput | null,
): selection is RepositoryDiffSelection =>
  selection !== null && "snapshotId" in selection;

const toSelectionRequest = (
  selection: RepositoryDiffSelectionInput | null,
): RepositoryDiffSelectionRequest | null =>
  selection === null
    ? null
    : { worktreeId: selection.worktreeId, path: selection.path };

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
    isSnapshotSelection(requestedSelection) ? requestedSelection : null,
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
    isSnapshotSelection(requestedSelection) ? requestedSelection : null,
  );
  const selectionRequestRef = useRef<RepositoryDiffSelectionRequest | null>(
    toSelectionRequest(requestedSelection),
  );
  const stateRef = useRef(state);
  const cycleIdRef = useRef(0);
  const requestGenerationRef = useRef(0);
  const detailGenerationRef = useRef(0);
  const detailCacheRef = useRef(new Map<string, RepositoryFileReview>());
  const ignoredPageGenerationRef = useRef(new Map<string, number>());
  const refreshDrainRef = useRef<Promise<boolean> | null>(null);
  const refreshPendingRef = useRef(false);
  const ignoredQueueRef = useRef<IgnoredPageQueueItem[]>([]);
  const ignoredPendingRef = useRef(new Map<string, Promise<boolean>>());
  const ignoredRunningNodeRef = useRef(new Set<string>());
  const ignoredActiveCountRef = useRef(0);
  const ignoredDrainRef = useRef<() => void>(() => undefined);

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

  const clearQueuedIgnoredRequests = useCallback((): void => {
    const queued = ignoredQueueRef.current.splice(0);
    queued.forEach((item) => {
      ignoredPendingRef.current.delete(item.key);
      item.resolve(false);
    });
  }, []);

  const invalidate = useCallback((): void => {
    requestGenerationRef.current += 1;
    detailGenerationRef.current += 1;
    detailCacheRef.current.clear();
    clearQueuedIgnoredRequests();
    ignoredPageGenerationRef.current.clear();
    dispatch({ type: "reset" });
  }, [clearQueuedIgnoredRequests]);

  const loadDetail = useCallback(
    async (
      request: RepositoryDiffRequestIdentity,
      overview: RepositoryDiffOverview,
      requested: RepositoryDiffSelectionRequest | null,
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
        worktreeId: requested.worktreeId,
        snapshotId,
        path: requested.path,
      };
      selectionRequestRef.current = requested;
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
      const detailCacheKey = createDetailCacheKey(
        detailSelection.worktreeId,
        snapshotId,
        detailSelection.path,
      );
      const cachedReview = detailCacheRef.current.get(detailCacheKey);
      if (cachedReview !== undefined) {
        rememberDetail(detailCacheRef.current, detailCacheKey, cachedReview);
        dispatch({ type: "detailSucceeded", identity, review: cachedReview });
        return true;
      }

      const endFileSpan = startPerformanceSpan(
        createPerformanceCorrelationId("repository-file"),
        "repository.file",
        { path: detailSelection.path, cacheHit: false },
      );
      try {
        const review = await api.loadRepositoryFile({
          worktreeId: request.worktreeId,
          currentSnapshotId: snapshotId,
          path: detailSelection.path,
        });
        endFileSpan({ outcome: "success" });
        if (
          !isActive(request) ||
          detailGenerationRef.current !== detailGeneration
        ) {
          return false;
        }
        rememberDetail(detailCacheRef.current, detailCacheKey, review);
        dispatch({ type: "detailSucceeded", identity, review });
        return true;
      } catch (error) {
        endFileSpan({ outcome: "failed" });
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
      detailCacheRef.current.clear();
      clearQueuedIgnoredRequests();
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

      const endOverviewSpan = startPerformanceSpan(
        createPerformanceCorrelationId("repository-overview"),
        "repository.overview",
        { worktreeId: request.worktreeId },
      );
      try {
        const overview = await api.loadRepositoryDiff(
          createOverviewRequest(request),
        );
        endOverviewSpan({
          outcome: "success",
          changedPaths: overview.changed.length,
        });
        if (!isActive(request)) {
          return false;
        }
        dispatch({ type: "overviewSucceeded", request, overview });
        return loadDetail(
          request,
          overview,
          selectionRequestRef.current,
          allowStaleRecovery,
          () => executeOverview(cycleId, false),
        );
      } catch (error) {
        endOverviewSpan({ outcome: "failed" });
        const failure = normalizeRepositoryDiffOverviewFailure(error);
        if (!isActive(request)) {
          return false;
        }
        dispatch({ type: "overviewFailed", request, error: failure });
        return false;
      }
    },
    [api, clearQueuedIgnoredRequests, isActive, loadDetail],
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
      selectionRequestRef.current = toSelectionRequest(nextSelection);
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

  const runIgnoredPage = useCallback(
    async (item: IgnoredPageQueueItem): Promise<void> => {
      const currentGeneration =
        ignoredPageGenerationRef.current.get(item.nodeId) ?? 0;
      const pageGeneration = currentGeneration + 1;
      ignoredPageGenerationRef.current.set(item.nodeId, pageGeneration);
      const identity: RepositoryDiffIgnoredPageIdentity = {
        request: item.request,
        snapshotId: item.snapshotId,
        nodeId: item.nodeId,
        cursor: item.cursor,
        pageGeneration,
      };
      dispatch({ type: "ignoredPageRequested", identity });

      let result = false;
      try {
        if (isActive(item.request)) {
          const requestPayload: TraverseRepositoryIgnoredRequest =
            item.cursor === null
              ? {
                  worktreeId: item.request.worktreeId,
                  currentSnapshotId: item.snapshotId,
                  nodeId: item.nodeId,
                }
              : {
                  worktreeId: item.request.worktreeId,
                  currentSnapshotId: item.snapshotId,
                  nodeId: item.nodeId,
                  cursor: item.cursor,
                };
          const response = await api.traverseRepositoryIgnored(requestPayload);
          if (
            isActive(item.request) &&
            ignoredPageGenerationRef.current.get(item.nodeId) === pageGeneration
          ) {
            dispatch({
              type: "ignoredPageSucceeded",
              identity,
              page: response,
            });
            result = true;
          }
        }
      } catch (error) {
        const failure = normalizeRepositoryDiffIgnoredPageFailure(error);
        if (
          isActive(item.request) &&
          ignoredPageGenerationRef.current.get(item.nodeId) === pageGeneration
        ) {
          dispatch({ type: "ignoredPageFailed", identity, error: failure });
        }
      } finally {
        ignoredRunningNodeRef.current.delete(item.nodeId);
        ignoredActiveCountRef.current -= 1;
        ignoredPendingRef.current.delete(item.key);
        item.resolve(result);
        ignoredDrainRef.current();
      }
    },
    [api, isActive],
  );

  const drainIgnoredQueue = useCallback((): void => {
    while (ignoredActiveCountRef.current < 2) {
      const nextIndex = ignoredQueueRef.current.findIndex(
        (item) => !ignoredRunningNodeRef.current.has(item.nodeId),
      );
      if (nextIndex < 0) {
        return;
      }
      const [nextItem] = ignoredQueueRef.current.splice(nextIndex, 1);
      if (nextItem === undefined) {
        return;
      }
      ignoredRunningNodeRef.current.add(nextItem.nodeId);
      ignoredActiveCountRef.current += 1;
      void runIgnoredPage(nextItem);
    }
  }, [runIgnoredPage]);

  ignoredDrainRef.current = drainIgnoredQueue;

  const loadIgnoredChildren = useCallback(
    (nodeId: string, requestedCursor?: string | null): Promise<boolean> => {
      const currentState = stateRef.current;
      const request = currentState.request;
      const snapshotId = currentState.overview?.currentSnapshotId ?? null;
      if (
        currentState.status !== "ready" ||
        request === null ||
        snapshotId === null ||
        nodeId.length === 0
      ) {
        return Promise.resolve(false);
      }
      const previousPage = currentState.ignoredPages[nodeId];
      const cursor =
        requestedCursor === undefined
          ? (previousPage?.nextCursor ?? null)
          : requestedCursor;
      const key = createIgnoredPageRequestKey(
        request,
        snapshotId,
        nodeId,
        cursor,
      );
      const existing = ignoredPendingRef.current.get(key);
      if (existing !== undefined) {
        return existing;
      }
      if (ignoredQueueRef.current.length >= 32) {
        return Promise.resolve(false);
      }
      let resolvePromise: (result: boolean) => void = () => undefined;
      const promise = new Promise<boolean>((resolve) => {
        resolvePromise = resolve;
      });
      ignoredPendingRef.current.set(key, promise);
      ignoredQueueRef.current.push({
        key,
        request,
        snapshotId,
        nodeId,
        cursor,
        resolve: resolvePromise,
      });
      ignoredDrainRef.current();
      return promise;
    },
    [],
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
    selectionRequestRef.current =
      requestedSelection !== null &&
      worktreeId !== null &&
      requestedSelection.worktreeId === worktreeId
        ? toSelectionRequest(requestedSelection)
        : null;
    selectionRef.current = null;
    setSelection(null);
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
      clearQueuedIgnoredRequests();
      ignoredPageGenerationRef.current.clear();
      refreshPendingRef.current = false;
    };
  }, [clearQueuedIgnoredRequests]);

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
