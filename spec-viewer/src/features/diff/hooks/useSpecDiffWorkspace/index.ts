import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import {
  createInitialSpecDiffWorkspaceState,
  createSpecChangeId,
  findSpecChange,
  projectSpecChangeBadges,
  reduceSpecDiffWorkspaceState,
  type SpecChangeOverview,
  type SpecDiffSelection,
  type SpecDiffWorkspaceState,
} from "@/features/diff/domain/specDiffWorkspaceState";
import {
  getSpecFileDiff,
  GetSpecFileDiffCommandError,
  listChangedSpecFiles,
  ListChangedSpecFilesCommandError,
  type GetSpecFileDiffCommandRequest,
  type GetSpecFileDiffCommandResponse,
  type ListChangedSpecFilesCommandRequest,
  type ListChangedSpecFilesCommandResponse,
} from "@/lib/api/tauri";

export type SpecDiffWorkspaceApi = Readonly<{
  listChangedSpecFiles: (
    request: ListChangedSpecFilesCommandRequest,
  ) => Promise<ListChangedSpecFilesCommandResponse>;
  getSpecFileDiff: (
    request: GetSpecFileDiffCommandRequest,
  ) => Promise<GetSpecFileDiffCommandResponse>;
}>;

export type UseSpecDiffWorkspaceOptions = Readonly<{
  workspacePath: string | null;
  selection: SpecDiffSelection;
  api?: SpecDiffWorkspaceApi;
}>;

export type UseSpecDiffWorkspaceResult = Readonly<{
  state: SpecDiffWorkspaceState;
  badges: ReadonlyMap<string, "U" | "M">;
  refresh: () => Promise<boolean>;
}>;

type RequestIdentity = Readonly<{
  workspacePath: string;
  cycleId: number;
  requestGeneration: number;
}>;

const DEFAULT_API: SpecDiffWorkspaceApi = {
  listChangedSpecFiles,
  getSpecFileDiff,
};

const STALE_DETAIL_ERROR_CODES = new Set([
  "staleSnapshot",
  "headChangedDuringRead",
  "staleBase",
  "entryChangedDuringRead",
]);

/**
 * Detaches the transport response from the pure diff workspace domain.
 *
 * @param response - Validated Tauri response.
 * @returns An immutable overview consumed by state and UI projections.
 */
export function toSpecChangeOverview(
  response: ListChangedSpecFilesCommandResponse,
): SpecChangeOverview {
  return {
    currentSnapshotId: response.currentSnapshotId,
    files: response.files.map((file) => ({ ...file })),
  };
}

/** Coordinates changed-file overview and selected-file detail requests. */
export function useSpecDiffWorkspace({
  workspacePath,
  selection,
  api = DEFAULT_API,
}: UseSpecDiffWorkspaceOptions): UseSpecDiffWorkspaceResult {
  const [state, dispatch] = useReducer(
    reduceSpecDiffWorkspaceState,
    undefined,
    createInitialSpecDiffWorkspaceState,
  );
  const mountedRef = useRef(true);
  const workspacePathRef = useRef(workspacePath);
  const selectionRef = useRef(selection);
  const stateRef = useRef(state);
  const cycleIdRef = useRef(0);
  const requestGenerationRef = useRef(0);
  const detailGenerationRef = useRef(0);
  const refreshDrainRef = useRef<Promise<boolean> | null>(null);
  const refreshPendingRef = useRef(false);

  workspacePathRef.current = workspacePath;
  selectionRef.current = selection;
  stateRef.current = state;

  const isActive = useCallback((identity: RequestIdentity): boolean => {
    return (
      mountedRef.current &&
      workspacePathRef.current === identity.workspacePath &&
      requestGenerationRef.current === identity.requestGeneration
    );
  }, []);

  const loadDetail = useCallback(
    async (
      identity: RequestIdentity,
      overview: SpecChangeOverview,
      detailSelection: SpecDiffSelection,
      allowStaleRecovery: boolean,
      recoverOverview: () => Promise<boolean>,
    ): Promise<boolean> => {
      const change = findSpecChange(overview.files, detailSelection);
      if (change === null) {
        return true;
      }

      const detailGeneration = detailGenerationRef.current + 1;
      detailGenerationRef.current = detailGeneration;
      const fileId = createSpecChangeId(change);

      try {
        const value = await api.getSpecFileDiff({
          workspacePath: identity.workspacePath,
          currentSnapshotId: overview.currentSnapshotId,
          specId: change.specId,
          fileKey: change.fileKey,
          path: change.targetPath,
        });
        if (
          !isActive(identity) ||
          detailGenerationRef.current !== detailGeneration
        ) {
          return false;
        }

        dispatch({ type: "detailSucceeded", ...identity, fileId, value });
        return true;
      } catch (error) {
        const normalized = GetSpecFileDiffCommandError.fromUnknown(error);
        if (
          !isActive(identity) ||
          detailGenerationRef.current !== detailGeneration
        ) {
          return false;
        }
        if (
          allowStaleRecovery &&
          STALE_DETAIL_ERROR_CODES.has(normalized.code)
        ) {
          return recoverOverview();
        }

        dispatch({
          type: "detailFailed",
          ...identity,
          fileId,
          message: normalized.message,
        });
        return false;
      }
    },
    [api, isActive],
  );

  const executeOverview = useCallback(
    async function execute(
      cycleId: number,
      allowStaleRecovery: boolean,
    ): Promise<boolean> {
      const activeWorkspacePath = workspacePathRef.current;
      if (activeWorkspacePath === null || !mountedRef.current) {
        return false;
      }

      detailGenerationRef.current += 1;
      const requestGeneration = requestGenerationRef.current + 1;
      requestGenerationRef.current = requestGeneration;
      const identity = {
        workspacePath: activeWorkspacePath,
        cycleId,
        requestGeneration,
      };
      dispatch({ type: "overviewStarted", ...identity });

      try {
        const response = await api.listChangedSpecFiles({
          workspacePath: activeWorkspacePath,
        });
        if (!isActive(identity)) {
          return false;
        }

        const overview = toSpecChangeOverview(response);
        const currentSelection = selectionRef.current;
        dispatch({
          type: "overviewSucceeded",
          ...identity,
          overview,
          selection: currentSelection,
        });
        return loadDetail(
          identity,
          overview,
          currentSelection,
          allowStaleRecovery,
          () => execute(cycleId, false),
        );
      } catch (error) {
        const normalized = ListChangedSpecFilesCommandError.fromUnknown(error);
        if (!isActive(identity)) {
          return false;
        }

        dispatch({
          type: "overviewFailed",
          ...identity,
          code: normalized.code,
          message: normalized.message,
        });
        return false;
      }
    },
    [api, isActive, loadDetail],
  );

  const refresh = useCallback((): Promise<boolean> => {
    if (workspacePathRef.current === null) {
      dispatch({ type: "workspaceCleared" });
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
    const promise = drain().finally(() => {
      if (refreshDrainRef.current === promise) {
        refreshDrainRef.current = null;
      }
    });
    refreshDrainRef.current = promise;
    return promise;
  }, [executeOverview]);

  useEffect(() => {
    if (workspacePath === null) {
      detailGenerationRef.current += 1;
      requestGenerationRef.current += 1;
      dispatch({ type: "workspaceCleared" });
      return;
    }

    void refresh();
  }, [refresh, workspacePath]);

  useEffect(() => {
    const currentState = stateRef.current;
    if (
      currentState.status !== "ready" ||
      currentState.workspacePath !== workspacePath
    ) {
      return;
    }

    const identity = {
      workspacePath: currentState.workspacePath,
      cycleId: currentState.cycleId,
      requestGeneration: currentState.requestGeneration,
    };
    dispatch({ type: "selectionChanged", ...identity, selection });
    void loadDetail(
      identity,
      currentState.overview,
      selection,
      false,
      async () => false,
    );
  }, [loadDetail, selection.fileKey, selection.specId, workspacePath]);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      detailGenerationRef.current += 1;
      requestGenerationRef.current += 1;
    };
  }, []);

  const badges = useMemo(
    () =>
      state.status === "ready"
        ? projectSpecChangeBadges(state.overview.files)
        : new Map<string, "U" | "M">(),
    [state],
  );

  return { state, badges, refresh };
}
