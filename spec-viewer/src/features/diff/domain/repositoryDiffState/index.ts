import type {
  RepositoryCurrentSnapshotId,
  RepositoryDiffOverview,
  RepositoryFileReview,
  RepositoryIgnoredCursor,
  RepositoryIgnoredPage,
  RepositoryNodeId,
  RepositoryTreeNode,
  RepositoryWorktreeId,
} from "@/features/diff/domain/repositoryDiff";
import type { RepositoryDiffFailure } from "@/features/diff/domain/repositoryDiffFailure";

/**
 * Coalescing window for external change notifications. The reducer only reads
 * timestamps it is handed; it never owns a timer.
 */
export const REPOSITORY_DIFF_REFRESH_DEBOUNCE_MS = 200;

/** Request identity shared by every identity-bearing state and action. */
export type RepositoryDiffRequestIdentity = Readonly<{
  worktreeId: RepositoryWorktreeId;
  baseOverride: string | null;
  generation: number;
}>;

export type RepositoryDirectoryExpansion =
  | Readonly<{ state: "collapsed" }>
  /**
   * In flight. `loaded` carries the pages already fetched, so entries never
   * disappear from the UI while a further page is loading.
   */
  | Readonly<{
      state: "expanding";
      loaded: readonly RepositoryTreeNode[];
      cursor: RepositoryIgnoredCursor | null;
    }>
  | Readonly<{
      state: "expanded";
      entries: readonly RepositoryTreeNode[];
      nextCursor: RepositoryIgnoredCursor | null;
    }>
  /** Records the failure while keeping fetched pages, for partial display plus retry. */
  | Readonly<{
      state: "failed";
      loaded: readonly RepositoryTreeNode[];
      failure: RepositoryDiffFailure;
    }>;

export type RepositoryFileReviewState =
  | Readonly<{ state: "none" }>
  | Readonly<{ state: "loading"; path: string }>
  | Readonly<{ state: "loaded"; path: string; review: RepositoryFileReview }>
  | Readonly<{ state: "failed"; path: string; failure: RepositoryDiffFailure }>;

/**
 * Debounce and coalescing state for external changes, independent of how the
 * watch is implemented.
 */
export type RepositoryRefreshState =
  /** Nothing to do. */
  | Readonly<{ state: "settled" }>
  /** Inside the debounce window; `debounceElapsed` moves it on. */
  | Readonly<{ state: "debouncing"; dueAt: number; coalescedCount: number }>
  /** The window closed and a refetch is owed but not yet started. */
  | Readonly<{ state: "due"; coalescedCount: number }>
  /** A change arrived mid-flight; it drains to `due` exactly once on completion. */
  | Readonly<{ state: "pending"; coalescedCount: number }>;

export type RepositoryDiffState =
  | Readonly<{ status: "idle" }>
  | (RepositoryDiffRequestIdentity &
      Readonly<{ status: "loading"; refresh: RepositoryRefreshState }>)
  | (RepositoryDiffRequestIdentity &
      Readonly<{
        status: "loaded";
        overview: RepositoryDiffOverview;
        expansions: ReadonlyMap<RepositoryNodeId, RepositoryDirectoryExpansion>;
        fileReview: RepositoryFileReviewState;
        refresh: RepositoryRefreshState;
      }>)
  | (RepositoryDiffRequestIdentity &
      Readonly<{
        status: "error";
        failure: RepositoryDiffFailure;
        refresh: RepositoryRefreshState;
      }>);

/** Extra identity carried by snapshot-scoped actions. */
type SnapshotScoped = Readonly<{ snapshotId: RepositoryCurrentSnapshotId }>;

export type RepositoryDiffAction =
  /** Always accepted, from any state. */
  | Readonly<{ type: "worktreeCleared" }>
  /** Always accepted; it starts a new request. */
  | (RepositoryDiffRequestIdentity & Readonly<{ type: "overviewStarted" }>)
  | (RepositoryDiffRequestIdentity &
      Readonly<{ type: "overviewSucceeded"; overview: RepositoryDiffOverview }>)
  | (RepositoryDiffRequestIdentity &
      Readonly<{ type: "overviewFailed"; failure: RepositoryDiffFailure }>)
  | (RepositoryDiffRequestIdentity &
      SnapshotScoped &
      Readonly<{
        type: "directoryExpansionStarted";
        nodeId: RepositoryNodeId;
        cursor: RepositoryIgnoredCursor | null;
      }>)
  | (RepositoryDiffRequestIdentity &
      SnapshotScoped &
      Readonly<{
        type: "directoryExpansionSucceeded";
        page: RepositoryIgnoredPage;
      }>)
  | (RepositoryDiffRequestIdentity &
      SnapshotScoped &
      Readonly<{
        type: "directoryExpansionFailed";
        nodeId: RepositoryNodeId;
        failure: RepositoryDiffFailure;
      }>)
  | (RepositoryDiffRequestIdentity &
      SnapshotScoped &
      Readonly<{ type: "fileReviewStarted"; path: string }>)
  | (RepositoryDiffRequestIdentity &
      SnapshotScoped &
      Readonly<{
        type: "fileReviewSucceeded";
        path: string;
        review: RepositoryFileReview;
      }>)
  | (RepositoryDiffRequestIdentity &
      SnapshotScoped &
      Readonly<{
        type: "fileReviewFailed";
        path: string;
        failure: RepositoryDiffFailure;
      }>)
  /** Abstract trigger for file watch and manual refresh; carries no identity. */
  | Readonly<{ type: "externalChangeDetected"; at: number }>
  /** Debounce window expiry, driven by the hook's timer. */
  | Readonly<{ type: "debounceElapsed"; at: number }>;

/**
 * @returns The initial idle state, before any worktree is selected.
 */
export function createInitialRepositoryDiffState(): RepositoryDiffState {
  return { status: "idle" };
}

/**
 * @param state - Current state.
 * @returns True when the hook should fire a new overview request.
 */
export function shouldStartOverview(state: RepositoryDiffState): boolean {
  return state.status !== "idle" && state.refresh.state === "due";
}

/**
 * Determines whether an action still belongs to the state's current request.
 *
 * @param state - Current state.
 * @param action - The identity carried by an incoming action.
 * @returns False for the idle state or a mismatched identity; true otherwise.
 */
function isCurrentRequest(
  state: RepositoryDiffState,
  action: RepositoryDiffRequestIdentity,
): boolean {
  if (state.status === "idle") {
    return false;
  }

  return (
    state.worktreeId === action.worktreeId &&
    state.baseOverride === action.baseOverride &&
    state.generation === action.generation
  );
}

/**
 * Drains a `pending` refresh once a request settles, so exactly one refetch
 * follows the coalesced changes.
 *
 * @param refresh - Refresh state at the moment the request settled.
 * @returns The refresh state to carry into the settled state.
 */
function drainRefresh(refresh: RepositoryRefreshState): RepositoryRefreshState {
  if (refresh.state === "pending") {
    return { state: "due", coalescedCount: refresh.coalescedCount };
  }

  return refresh;
}

/**
 * @param refresh - Refresh state before the change arrived.
 * @param at - Timestamp of the change notification.
 * @returns A refreshed debounce window, extending any window already open.
 */
function openDebounceWindow(
  refresh: RepositoryRefreshState,
  at: number,
): RepositoryRefreshState {
  const coalescedCount =
    refresh.state === "settled" ? 1 : refresh.coalescedCount + 1;

  return {
    state: "debouncing",
    dueAt: at + REPOSITORY_DIFF_REFRESH_DEBOUNCE_MS,
    coalescedCount,
  };
}

/**
 * @param map - Current expansion map.
 * @param nodeId - Node whose expansion changed.
 * @param expansion - The expansion to store.
 * @returns A new map with the node's expansion replaced.
 */
function withExpansion(
  map: ReadonlyMap<RepositoryNodeId, RepositoryDirectoryExpansion>,
  nodeId: RepositoryNodeId,
  expansion: RepositoryDirectoryExpansion,
): ReadonlyMap<RepositoryNodeId, RepositoryDirectoryExpansion> {
  const next = new Map(map);
  next.set(nodeId, expansion);

  return next;
}

/**
 * @param expansion - Current expansion for a node, if any.
 * @returns The entries already fetched for that node.
 */
function loadedEntriesOf(
  expansion: RepositoryDirectoryExpansion | undefined,
): readonly RepositoryTreeNode[] {
  if (expansion === undefined || expansion.state === "collapsed") {
    return [];
  }
  if (expansion.state === "expanded") {
    return expansion.entries;
  }

  return expansion.loaded;
}

/**
 * Pure state machine for repository-wide diff retrieval.
 *
 * Stale actions — a mismatched identity, or a snapshot-scoped action whose
 * `snapshotId` is no longer current — leave the state untouched and return the
 * very same reference.
 *
 * @param state - Current state.
 * @param action - Action to apply.
 * @returns The next state, or the same reference when the action is stale.
 */
export function reduceRepositoryDiffState(
  state: RepositoryDiffState,
  action: RepositoryDiffAction,
): RepositoryDiffState {
  if (action.type === "worktreeCleared") {
    return createInitialRepositoryDiffState();
  }

  if (action.type === "overviewStarted") {
    return {
      status: "loading",
      worktreeId: action.worktreeId,
      baseOverride: action.baseOverride,
      generation: action.generation,
      refresh: { state: "settled" },
    };
  }

  if (action.type === "externalChangeDetected") {
    if (state.status === "idle") {
      return state;
    }

    return { ...state, refresh: openDebounceWindow(state.refresh, action.at) };
  }

  if (action.type === "debounceElapsed") {
    if (
      state.status === "idle" ||
      state.refresh.state !== "debouncing" ||
      action.at < state.refresh.dueAt
    ) {
      return state;
    }

    const coalescedCount = state.refresh.coalescedCount;

    return {
      ...state,
      refresh:
        state.status === "loading"
          ? { state: "pending", coalescedCount }
          : { state: "due", coalescedCount },
    };
  }

  if (!isCurrentRequest(state, action) || state.status === "idle") {
    return state;
  }

  if (action.type === "overviewSucceeded") {
    return {
      status: "loaded",
      worktreeId: action.worktreeId,
      baseOverride: action.baseOverride,
      generation: action.generation,
      overview: action.overview,
      expansions: new Map(),
      fileReview: { state: "none" },
      refresh: drainRefresh(state.refresh),
    };
  }

  if (action.type === "overviewFailed") {
    return {
      status: "error",
      worktreeId: action.worktreeId,
      baseOverride: action.baseOverride,
      generation: action.generation,
      failure: action.failure,
      refresh: drainRefresh(state.refresh),
    };
  }

  if (
    state.status !== "loaded" ||
    state.overview.currentSnapshotId !== action.snapshotId
  ) {
    return state;
  }

  if (action.type === "directoryExpansionStarted") {
    const current = state.expansions.get(action.nodeId);
    if (current?.state === "expanding") {
      return state;
    }

    return {
      ...state,
      expansions: withExpansion(state.expansions, action.nodeId, {
        state: "expanding",
        loaded: action.cursor === null ? [] : loadedEntriesOf(current),
        cursor: action.cursor,
      }),
    };
  }

  if (action.type === "directoryExpansionSucceeded") {
    const current = state.expansions.get(action.page.nodeId);
    if (current?.state !== "expanding") {
      return state;
    }

    return {
      ...state,
      expansions: withExpansion(state.expansions, action.page.nodeId, {
        state: "expanded",
        entries: [...current.loaded, ...action.page.entries],
        nextCursor: action.page.nextCursor,
      }),
    };
  }

  if (action.type === "directoryExpansionFailed") {
    const current = state.expansions.get(action.nodeId);
    if (current?.state !== "expanding") {
      return state;
    }

    return {
      ...state,
      expansions: withExpansion(state.expansions, action.nodeId, {
        state: "failed",
        loaded: current.loaded,
        failure: action.failure,
      }),
    };
  }

  if (action.type === "fileReviewStarted") {
    return {
      ...state,
      fileReview: { state: "loading", path: action.path },
    };
  }

  if (
    state.fileReview.state !== "loading" ||
    state.fileReview.path !== action.path
  ) {
    return state;
  }

  if (action.type === "fileReviewSucceeded") {
    return {
      ...state,
      fileReview: {
        state: "loaded",
        path: action.path,
        review: action.review,
      },
    };
  }

  return {
    ...state,
    fileReview: {
      state: "failed",
      path: action.path,
      failure: action.failure,
    },
  };
}
