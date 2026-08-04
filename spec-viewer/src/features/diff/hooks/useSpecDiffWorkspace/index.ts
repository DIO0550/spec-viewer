import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import {
  ComparisonRevision,
  type ComparisonRevision as ComparisonRevisionValue,
  type RevisionOption,
  type SpecFileHistory,
} from "@/features/diff/domain/comparisonRevision";
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
  listSpecDiffRevisions,
  listSpecFileCommitHistory,
  type GetSpecFileDiffCommandRequest,
  type GetSpecFileDiffCommandResponse,
  type ListChangedSpecFilesCommandRequest,
  type ListChangedSpecFilesCommandResponse,
  type ListSpecDiffRevisionsRequest,
  type ListSpecFileCommitHistoryRequest,
} from "@/lib/api/tauri";

export type AsyncCatalogState<T> =
  | Readonly<{ status: "loading"; value: T }>
  | Readonly<{ status: "ready"; value: T }>
  | Readonly<{ status: "failed"; value: T; message: string }>;

export type ComparisonOperation =
  | Readonly<{ status: "idle" }>
  | Readonly<{ status: "loading"; requested: ComparisonRevisionValue }>
  | Readonly<{
      status: "failed";
      requested: ComparisonRevisionValue;
      message: string;
    }>;

export type SpecDiffWorkspaceApi = Readonly<{
  listChangedSpecFiles: (
    request: ListChangedSpecFilesCommandRequest,
  ) => Promise<ListChangedSpecFilesCommandResponse>;
  getSpecFileDiff: (
    request: GetSpecFileDiffCommandRequest,
  ) => Promise<GetSpecFileDiffCommandResponse>;
  listSpecDiffRevisions?: (
    request: ListSpecDiffRevisionsRequest,
  ) => Promise<readonly RevisionOption[]>;
  listSpecFileCommitHistory?: (
    request: ListSpecFileCommitHistoryRequest,
  ) => Promise<SpecFileHistory>;
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
  comparison: ComparisonRevisionValue;
  revisionOptions: AsyncCatalogState<readonly RevisionOption[]>;
  fileHistory: AsyncCatalogState<SpecFileHistory>;
  comparisonOperation: ComparisonOperation;
  selectComparison: (revision: ComparisonRevisionValue) => Promise<boolean>;
  retryRevisionOptions: () => Promise<boolean>;
  retryFileHistory: () => Promise<boolean>;
}>;

type RequestIdentity = Readonly<{
  workspacePath: string;
  cycleId: number;
  requestGeneration: number;
}>;

const DEFAULT_API: SpecDiffWorkspaceApi = {
  listChangedSpecFiles,
  getSpecFileDiff,
  listSpecDiffRevisions,
  listSpecFileCommitHistory,
};

const HEAD_OPTION: RevisionOption = {
  id: "head",
  revision: ComparisonRevision.head(),
  label: "HEAD",
  resolvedCommitSha: "",
};
const EMPTY_HISTORY: SpecFileHistory = { items: [], truncated: false };

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
    resolvedBaseSha: response.resolvedBaseSha,
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
  const [comparison, setComparison] = useState<ComparisonRevisionValue>(
    ComparisonRevision.head,
  );
  const [revisionOptions, setRevisionOptions] = useState<
    AsyncCatalogState<readonly RevisionOption[]>
  >({ status: "loading", value: [HEAD_OPTION] });
  const [fileHistory, setFileHistory] = useState<
    AsyncCatalogState<SpecFileHistory>
  >({ status: "loading", value: EMPTY_HISTORY });
  const [comparisonOperation, setComparisonOperation] =
    useState<ComparisonOperation>({ status: "idle" });
  const mountedRef = useRef(true);
  const workspacePathRef = useRef(workspacePath);
  const selectionRef = useRef(selection);
  const stateRef = useRef(state);
  const cycleIdRef = useRef(0);
  const requestGenerationRef = useRef(0);
  const detailGenerationRef = useRef(0);
  const refreshDrainRef = useRef<Promise<boolean> | null>(null);
  const refreshPendingRef = useRef(false);
  const comparisonRef = useRef<ComparisonRevisionValue>(comparison);
  const comparisonRequestTokenRef = useRef<symbol>(Symbol());
  const optionsRequestTokenRef = useRef<symbol>(Symbol());
  const historyRequestTokenRef = useRef<symbol>(Symbol());

  workspacePathRef.current = workspacePath;
  selectionRef.current = selection;
  stateRef.current = state;
  comparisonRef.current = comparison;

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
          resolvedBaseSha: overview.resolvedBaseSha,
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
        const response = await api.listChangedSpecFiles(
          comparisonRef.current.kind === "head"
            ? { workspacePath: activeWorkspacePath }
            : {
                workspacePath: activeWorkspacePath,
                comparison: comparisonRef.current,
              },
        );
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

  const retryRevisionOptions = useCallback(async (): Promise<boolean> => {
    const activeWorkspacePath = workspacePathRef.current;
    const token = Symbol();
    optionsRequestTokenRef.current = token;
    setRevisionOptions((current) => ({
      status: "loading",
      value: current.value,
    }));
    if (
      activeWorkspacePath === null ||
      api.listSpecDiffRevisions === undefined
    ) {
      setRevisionOptions({ status: "ready", value: [HEAD_OPTION] });
      return false;
    }
    try {
      const options = await api.listSpecDiffRevisions({
        workspacePath: activeWorkspacePath,
      });
      if (
        !mountedRef.current ||
        optionsRequestTokenRef.current !== token ||
        workspacePathRef.current !== activeWorkspacePath
      ) {
        return false;
      }
      const withoutDuplicateHead = options.filter(
        (option) => option.revision.kind !== "head",
      );
      setRevisionOptions({
        status: "ready",
        value: [HEAD_OPTION, ...withoutDuplicateHead],
      });
      return true;
    } catch (error) {
      if (
        !mountedRef.current ||
        optionsRequestTokenRef.current !== token ||
        workspacePathRef.current !== activeWorkspacePath
      ) {
        return false;
      }
      const normalized = ListChangedSpecFilesCommandError.fromUnknown(error);
      setRevisionOptions((current) => ({
        status: "failed",
        value: current.value,
        message: normalized.message,
      }));
      return false;
    }
  }, [api]);

  const retryFileHistory = useCallback(async (): Promise<boolean> => {
    const activeWorkspacePath = workspacePathRef.current;
    const currentState = stateRef.current;
    const change =
      currentState.status === "ready"
        ? findSpecChange(currentState.overview.files, selectionRef.current)
        : null;
    const token = Symbol();
    historyRequestTokenRef.current = token;
    setFileHistory((current) => ({ status: "loading", value: current.value }));
    if (
      activeWorkspacePath === null ||
      change === null ||
      api.listSpecFileCommitHistory === undefined
    ) {
      setFileHistory({ status: "ready", value: EMPTY_HISTORY });
      return false;
    }
    try {
      const history = await api.listSpecFileCommitHistory({
        workspacePath: activeWorkspacePath,
        specId: change.specId,
        fileKey: change.fileKey,
        path: change.targetPath,
      });
      if (
        !mountedRef.current ||
        historyRequestTokenRef.current !== token ||
        workspacePathRef.current !== activeWorkspacePath ||
        selectionRef.current.specId !== change.specId ||
        selectionRef.current.fileKey !== change.fileKey
      ) {
        return false;
      }
      setFileHistory({ status: "ready", value: history });
      return true;
    } catch (error) {
      if (!mountedRef.current || historyRequestTokenRef.current !== token) {
        return false;
      }
      const normalized = ListChangedSpecFilesCommandError.fromUnknown(error);
      setFileHistory((current) => ({
        status: "failed",
        value: current.value,
        message: normalized.message,
      }));
      return false;
    }
  }, [api]);

  const selectComparison = useCallback(
    async (requested: ComparisonRevisionValue): Promise<boolean> => {
      const currentState = stateRef.current;
      if (
        currentState.status !== "ready" ||
        ComparisonRevision.equals(comparisonRef.current, requested)
      ) {
        return currentState.status === "ready";
      }
      const token = Symbol();
      comparisonRequestTokenRef.current = token;
      setComparisonOperation({ status: "loading", requested });
      const identity = {
        workspacePath: currentState.workspacePath,
        cycleId: currentState.cycleId,
        requestGeneration: currentState.requestGeneration,
      };

      const attempt = async (allowStaleRecovery: boolean): Promise<boolean> => {
        try {
          const response = await api.listChangedSpecFiles({
            workspacePath: identity.workspacePath,
            comparison: requested,
          });
          const overview = toSpecChangeOverview(response);
          const currentSelection = selectionRef.current;
          const change = findSpecChange(overview.files, currentSelection);
          const detail =
            change === null
              ? null
              : await api.getSpecFileDiff({
                  workspacePath: identity.workspacePath,
                  currentSnapshotId: overview.currentSnapshotId,
                  resolvedBaseSha: overview.resolvedBaseSha,
                  specId: change.specId,
                  fileKey: change.fileKey,
                  path: change.targetPath,
                });
          if (
            !isActive(identity) ||
            comparisonRequestTokenRef.current !== token
          ) {
            return false;
          }
          dispatch({
            type: "overviewSucceeded",
            ...identity,
            overview,
            selection: currentSelection,
          });
          if (change !== null && detail !== null) {
            dispatch({
              type: "detailSucceeded",
              ...identity,
              fileId: createSpecChangeId(change),
              value: detail,
            });
          }
          comparisonRef.current = requested;
          setComparison(requested);
          setComparisonOperation({ status: "idle" });
          return true;
        } catch (error) {
          const normalized =
            ListChangedSpecFilesCommandError.fromUnknown(error);
          if (
            !isActive(identity) ||
            comparisonRequestTokenRef.current !== token
          ) {
            return false;
          }
          if (
            allowStaleRecovery &&
            STALE_DETAIL_ERROR_CODES.has(normalized.code)
          ) {
            return attempt(false);
          }
          setComparisonOperation({
            status: "failed",
            requested,
            message: normalized.message,
          });
          return false;
        }
      };
      return attempt(true);
    },
    [api, isActive],
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
    comparisonRequestTokenRef.current = Symbol();
    optionsRequestTokenRef.current = Symbol();
    historyRequestTokenRef.current = Symbol();
    comparisonRef.current = ComparisonRevision.head();
    setComparison(ComparisonRevision.head());
    setComparisonOperation({ status: "idle" });
    setRevisionOptions({ status: "loading", value: [HEAD_OPTION] });
    setFileHistory({ status: "loading", value: EMPTY_HISTORY });
    if (workspacePath === null) {
      detailGenerationRef.current += 1;
      requestGenerationRef.current += 1;
      dispatch({ type: "workspaceCleared" });
      return;
    }

    void refresh();
    void retryRevisionOptions();
  }, [refresh, retryRevisionOptions, workspacePath]);

  useEffect(() => {
    comparisonRequestTokenRef.current = Symbol();
    setComparisonOperation({ status: "idle" });
    if (comparisonRef.current.kind !== "head") {
      comparisonRef.current = ComparisonRevision.head();
      setComparison(ComparisonRevision.head());
      void refresh();
      return;
    }
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
  }, [loadDetail, refresh, selection.fileKey, selection.specId, workspacePath]);

  useEffect(() => {
    if (state.status !== "ready") {
      return;
    }
    void retryFileHistory();
  }, [
    retryFileHistory,
    selection.fileKey,
    selection.specId,
    state.status,
    state.status === "ready" ? state.overview.currentSnapshotId : null,
  ]);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      detailGenerationRef.current += 1;
      requestGenerationRef.current += 1;
      comparisonRequestTokenRef.current = Symbol();
      optionsRequestTokenRef.current = Symbol();
      historyRequestTokenRef.current = Symbol();
    };
  }, []);

  const badges = useMemo(
    () =>
      state.status === "ready"
        ? projectSpecChangeBadges(state.overview.files)
        : new Map<string, "U" | "M">(),
    [state],
  );

  return {
    state,
    badges,
    refresh,
    comparison,
    revisionOptions,
    fileHistory,
    comparisonOperation,
    selectComparison,
    retryRevisionOptions,
    retryFileHistory,
  };
}
