import type {
  IgnoredPage,
  RepositoryDiffOverview,
  RepositoryFileReview,
} from "./repositoryDiff";

export type RepositoryDiffRequestIdentity = Readonly<{
  workspacePath: string;
  worktreeId: string;
  baseOverride: string | null;
  cycleId: number;
  requestGeneration: number;
}>;

export type RepositoryDiffDetailIdentity = Readonly<{
  request: RepositoryDiffRequestIdentity;
  snapshotId: string;
  path: string;
  detailGeneration: number;
}>;

export type RepositoryDiffIgnoredPageIdentity = Readonly<{
  request: RepositoryDiffRequestIdentity;
  snapshotId: string;
  nodeId: string;
  cursor: string | null;
  pageGeneration: number;
}>;

export type RepositoryDiffFailure = Readonly<{
  code: string;
  message: string;
  retryable: boolean;
}>;

export type RepositoryDiffDetailState =
  | Readonly<{ status: "unchanged" }>
  | Readonly<{
      status: "loading";
      identity: RepositoryDiffDetailIdentity;
    }>
  | Readonly<{
      status: "ready";
      identity: RepositoryDiffDetailIdentity;
      review: RepositoryFileReview;
    }>
  | Readonly<{
      status: "unavailable";
      identity: RepositoryDiffDetailIdentity;
      error: RepositoryDiffFailure;
    }>
  | Readonly<{
      status: "failed";
      identity: RepositoryDiffDetailIdentity;
      error: RepositoryDiffFailure;
    }>;

export type RepositoryDiffWorkspaceStatus =
  | "idle"
  | "loading"
  | "ready"
  | "needsSelection"
  | "invalidOverride"
  | "unavailable"
  | "failed";

export type RepositoryDiffIgnoredPageState =
  | Readonly<{ status: "idle" }>
  | Readonly<{
      status: "loading";
      identity: RepositoryDiffIgnoredPageIdentity;
    }>
  | Readonly<{
      status: "ready";
      identity: RepositoryDiffIgnoredPageIdentity;
      page: IgnoredPage;
    }>
  | Readonly<{
      status: "failed";
      identity: RepositoryDiffIgnoredPageIdentity;
      error: RepositoryDiffFailure;
    }>;

export type RepositoryDiffWorkspaceState = Readonly<{
  status: RepositoryDiffWorkspaceStatus;
  request: RepositoryDiffRequestIdentity | null;
  overview: RepositoryDiffOverview | null;
  detail: RepositoryDiffDetailState;
  ignoredPages: Readonly<Record<string, IgnoredPage>>;
  ignoredPageStates: Readonly<Record<string, RepositoryDiffIgnoredPageState>>;
  error: RepositoryDiffFailure | null;
}>;

export type RepositoryDiffWorkspaceAction =
  | Readonly<{
      type: "overviewRequested";
      request: RepositoryDiffRequestIdentity;
    }>
  | Readonly<{
      type: "overviewSucceeded";
      request: RepositoryDiffRequestIdentity;
      overview: RepositoryDiffOverview;
    }>
  | Readonly<{
      type: "overviewFailed";
      request: RepositoryDiffRequestIdentity;
      error: RepositoryDiffFailure;
    }>
  | Readonly<{
      type: "detailRequested";
      identity: RepositoryDiffDetailIdentity;
    }>
  | Readonly<{
      type: "detailSucceeded";
      identity: RepositoryDiffDetailIdentity;
      review: RepositoryFileReview;
    }>
  | Readonly<{
      type: "detailFailed";
      identity: RepositoryDiffDetailIdentity;
      error: RepositoryDiffFailure;
    }>
  | Readonly<{
      type: "ignoredPageRequested";
      identity: RepositoryDiffIgnoredPageIdentity;
    }>
  | Readonly<{
      type: "ignoredPageSucceeded";
      identity: RepositoryDiffIgnoredPageIdentity;
      page: IgnoredPage;
    }>
  | Readonly<{
      type: "ignoredPageFailed";
      identity: RepositoryDiffIgnoredPageIdentity;
      error: RepositoryDiffFailure;
    }>
  | Readonly<{ type: "reset" }>;

const UNAVAILABLE_CODES = new Set([
  "notRepository",
  "bareRepository",
  "worktreeUnavailable",
  "unbornHead",
]);

/**
 * @returns A fresh idle repository diff workspace state.
 */
export function createInitialRepositoryDiffWorkspaceState(): RepositoryDiffWorkspaceState {
  return {
    status: "idle",
    request: null,
    overview: null,
    detail: { status: "unchanged" },
    ignoredPages: {},
    ignoredPageStates: {},
    error: null,
  };
}

/**
 * @param left - Current request identity.
 * @param right - Incoming request identity.
 * @returns True when both requests refer to the same generation.
 */
const isSameRequest = (
  left: RepositoryDiffRequestIdentity | null,
  right: RepositoryDiffRequestIdentity,
): boolean =>
  left !== null &&
  left.workspacePath === right.workspacePath &&
  left.worktreeId === right.worktreeId &&
  left.baseOverride === right.baseOverride &&
  left.cycleId === right.cycleId &&
  left.requestGeneration === right.requestGeneration;

/**
 * @param left - Current detail identity.
 * @param right - Incoming detail identity.
 * @returns True when both identities refer to the same detail request.
 */
const isSameDetail = (
  left: RepositoryDiffDetailIdentity,
  right: RepositoryDiffDetailIdentity,
): boolean =>
  isSameRequest(left.request, right.request) &&
  left.snapshotId === right.snapshotId &&
  left.path === right.path &&
  left.detailGeneration === right.detailGeneration;

/**
 * @param left - Current ignored-page identity.
 * @param right - Incoming ignored-page identity.
 * @returns True when both page requests refer to the same generation.
 */
const isSameIgnoredPage = (
  left: RepositoryDiffIgnoredPageIdentity,
  right: RepositoryDiffIgnoredPageIdentity,
): boolean =>
  isSameRequest(left.request, right.request) &&
  left.snapshotId === right.snapshotId &&
  left.nodeId === right.nodeId &&
  left.cursor === right.cursor &&
  left.pageGeneration === right.pageGeneration;

/**
 * @param error - Typed workspace failure.
 * @returns The top-level status for the failure.
 */
const statusForFailure = (
  error: RepositoryDiffFailure,
): "unavailable" | "failed" =>
  UNAVAILABLE_CODES.has(error.code) ? "unavailable" : "failed";

/**
 * @param state - Current immutable workspace state.
 * @param action - Incoming state transition.
 * @returns The next immutable repository diff state.
 */
export function repositoryDiffWorkspaceReducer(
  state: RepositoryDiffWorkspaceState,
  action: RepositoryDiffWorkspaceAction,
): RepositoryDiffWorkspaceState {
  if (action.type === "reset") {
    return createInitialRepositoryDiffWorkspaceState();
  }

  if (action.type === "overviewRequested") {
    return {
      status: "loading",
      request: action.request,
      overview: null,
      detail: { status: "unchanged" },
      ignoredPages: {},
      ignoredPageStates: {},
      error: null,
    };
  }

  if (action.type === "overviewSucceeded") {
    if (!isSameRequest(state.request, action.request)) {
      return state;
    }

    const status =
      action.overview.base.state === "resolved"
        ? "ready"
        : action.overview.base.state;

    return {
      status,
      request: action.request,
      overview: action.overview,
      detail: { status: "unchanged" },
      ignoredPages: {},
      ignoredPageStates: {},
      error: null,
    };
  }

  if (action.type === "overviewFailed") {
    if (!isSameRequest(state.request, action.request)) {
      return state;
    }

    return {
      status: statusForFailure(action.error),
      request: action.request,
      overview: null,
      detail: { status: "unchanged" },
      ignoredPages: {},
      ignoredPageStates: {},
      error: action.error,
    };
  }

  if (action.type === "detailRequested") {
    if (
      state.status !== "ready" ||
      !isSameRequest(state.request, action.identity.request) ||
      state.overview?.currentSnapshotId !== action.identity.snapshotId
    ) {
      return state;
    }

    return {
      ...state,
      detail: {
        status: "loading",
        identity: action.identity,
      },
      error: null,
    };
  }

  if (action.type === "detailSucceeded") {
    if (
      state.detail.status !== "loading" ||
      !isSameDetail(state.detail.identity, action.identity)
    ) {
      return state;
    }

    return {
      ...state,
      detail: {
        status: "ready",
        identity: action.identity,
        review: action.review,
      },
      error: null,
    };
  }

  if (action.type === "detailFailed") {
    if (
      state.detail.status !== "loading" ||
      !isSameDetail(state.detail.identity, action.identity)
    ) {
      return state;
    }

    return {
      ...state,
      detail: {
        status: statusForFailure(action.error),
        identity: action.identity,
        error: action.error,
      },
      error: action.error,
    };
  }

  if (action.type === "ignoredPageRequested") {
    if (
      state.status !== "ready" ||
      state.overview?.currentSnapshotId !== action.identity.snapshotId ||
      !isSameRequest(state.request, action.identity.request)
    ) {
      return state;
    }

    return {
      ...state,
      ignoredPageStates: {
        ...state.ignoredPageStates,
        [action.identity.nodeId]: {
          status: "loading",
          identity: action.identity,
        },
      },
    };
  }

  if (action.type === "ignoredPageSucceeded") {
    const currentPageState = state.ignoredPageStates[action.identity.nodeId];
    if (
      currentPageState?.status !== "loading" ||
      !isSameIgnoredPage(currentPageState.identity, action.identity) ||
      action.page.nodeId !== action.identity.nodeId
    ) {
      return state;
    }

    const previousPage = state.ignoredPages[action.identity.nodeId];
    const page =
      action.identity.cursor === null || previousPage === undefined
        ? action.page
        : {
            ...action.page,
            entries: [...previousPage.entries, ...action.page.entries],
          };

    return {
      ...state,
      ignoredPages: {
        ...state.ignoredPages,
        [action.identity.nodeId]: page,
      },
      ignoredPageStates: {
        ...state.ignoredPageStates,
        [action.identity.nodeId]: {
          status: "ready",
          identity: action.identity,
          page,
        },
      },
    };
  }

  if (action.type === "ignoredPageFailed") {
    const currentPageState = state.ignoredPageStates[action.identity.nodeId];
    if (
      currentPageState?.status !== "loading" ||
      !isSameIgnoredPage(currentPageState.identity, action.identity)
    ) {
      return state;
    }

    return {
      ...state,
      ignoredPageStates: {
        ...state.ignoredPageStates,
        [action.identity.nodeId]: {
          status: "failed",
          identity: action.identity,
          error: action.error,
        },
      },
    };
  }

  return state;
}
