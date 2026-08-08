import { DiffAvailability } from "@/features/diff/domain/diffAvailability";
import type {
  FileChangeStatus,
  FileDiff,
} from "@/features/diff/domain/fileDiff";
import type { SpecFileKey } from "@/features/specs/types/spec";

export type SpecChange = Readonly<{
  specId: string;
  fileKey: string;
  targetPath: string;
  oldPath: string | null;
  newPath: string | null;
  change: FileChangeStatus;
}>;

/**
 * Creates the stable UI identity for one logical Spec file change.
 *
 * @param file - Changed Spec file returned by the diff overview.
 * @returns An encoded identity that cannot confuse separators in a Spec ID.
 */
export function createSpecChangeId(file: SpecChange): string {
  return `${encodeURIComponent(file.specId)}:${encodeURIComponent(file.fileKey)}`;
}

export type SpecChangeBadge = "U" | "M";

const SPEC_CHANGE_BADGES = {
  added: "U",
  modified: "M",
  deleted: "M",
  renamed: "M",
  copied: "M",
  typeChanged: "M",
  untracked: "U",
} as const satisfies Readonly<Record<FileChangeStatus, SpecChangeBadge>>;

/**
 * Projects file changes into one badge per Spec.
 *
 * @param files - Changed Spec files in overview order.
 * @returns A detached badge map keyed by Spec ID.
 */
export function projectSpecChangeBadges(
  files: readonly SpecChange[],
): ReadonlyMap<string, SpecChangeBadge> {
  const badges = new Map<string, SpecChangeBadge>();

  for (const file of files) {
    const badge = SPEC_CHANGE_BADGES[file.change];
    if (badges.get(file.specId) === "U") {
      continue;
    }
    badges.set(file.specId, badge);
  }

  return badges;
}

export type SpecChangeOverview = Readonly<{
  resolvedBaseSha: string;
  currentSnapshotId: string;
  files: readonly SpecChange[];
}>;

export type SpecDiffSelection = Readonly<{
  specId: string | null;
  fileKey: SpecFileKey | null;
}>;

export type SpecDiffDetailState =
  | Readonly<{ status: "unchanged" }>
  | Readonly<{ status: "loading"; fileId: string }>
  | Readonly<{ status: "ready"; fileId: string; value: FileDiff }>
  | Readonly<{ status: "failed"; fileId: string; message: string }>;

type RequestIdentity = Readonly<{
  workspacePath: string;
  cycleId: number;
  requestGeneration: number;
}>;

export type SpecDiffWorkspaceState =
  | Readonly<{
      status: "idle";
      workspacePath: null;
      cycleId: 0;
      requestGeneration: 0;
    }>
  | (RequestIdentity & Readonly<{ status: "loading" }>)
  | (RequestIdentity &
      Readonly<{
        status: "ready";
        overview: SpecChangeOverview;
        detail: SpecDiffDetailState;
      }>)
  | (RequestIdentity & Readonly<{ status: "unavailable"; reason: string }>)
  | (RequestIdentity & Readonly<{ status: "failed"; message: string }>);

export type SpecDiffWorkspaceAction =
  | Readonly<{ type: "workspaceCleared" }>
  | (RequestIdentity & Readonly<{ type: "overviewStarted" }>)
  | (RequestIdentity &
      Readonly<{
        type: "overviewSucceeded";
        overview: SpecChangeOverview;
        selection: SpecDiffSelection;
      }>)
  | (RequestIdentity &
      Readonly<{
        type: "overviewFailed";
        code: string;
        message: string;
      }>)
  | (RequestIdentity &
      Readonly<{
        type: "selectionChanged";
        selection: SpecDiffSelection;
      }>)
  | (RequestIdentity &
      Readonly<{
        type: "detailSucceeded";
        fileId: string;
        value: FileDiff;
      }>)
  | (RequestIdentity &
      Readonly<{
        type: "detailFailed";
        fileId: string;
        message: string;
      }>);

/**
 * The initial state before a workspace is available.
 *
 * @returns The idle state with a zeroed request identity.
 */
export function createInitialSpecDiffWorkspaceState(): SpecDiffWorkspaceState {
  return {
    status: "idle",
    workspacePath: null,
    cycleId: 0,
    requestGeneration: 0,
  };
}

/**
 * Finds the changed file matching the shared Spec selection.
 *
 * @param files - Changed Spec files from the current overview.
 * @param selection - Shared Markdown and Diff logical file selection.
 * @returns The matching change, or null when the selected file is unchanged.
 */
export function findSpecChange(
  files: readonly SpecChange[],
  selection: SpecDiffSelection,
): SpecChange | null {
  if (selection.specId === null || selection.fileKey === null) {
    return null;
  }

  return (
    files.find(
      (file) =>
        file.specId === selection.specId && file.fileKey === selection.fileKey,
    ) ?? null
  );
}

/**
 * Reduces request lifecycle events without accepting stale results.
 *
 * @param state - Current immutable workspace state.
 * @param action - Request lifecycle event.
 * @returns The next immutable state.
 */
export function reduceSpecDiffWorkspaceState(
  state: SpecDiffWorkspaceState,
  action: SpecDiffWorkspaceAction,
): SpecDiffWorkspaceState {
  if (action.type === "workspaceCleared") {
    return createInitialSpecDiffWorkspaceState();
  }

  if (action.type === "overviewStarted") {
    return {
      status: "loading",
      workspacePath: action.workspacePath,
      cycleId: action.cycleId,
      requestGeneration: action.requestGeneration,
    };
  }

  if (!isCurrentRequest(state, action)) {
    return state;
  }

  if (action.type === "overviewFailed") {
    if (DiffAvailability.isRepositoryUnavailable(action.code)) {
      return {
        status: "unavailable",
        workspacePath: action.workspacePath,
        cycleId: action.cycleId,
        requestGeneration: action.requestGeneration,
        reason: action.message,
      };
    }

    return {
      status: "failed",
      workspacePath: action.workspacePath,
      cycleId: action.cycleId,
      requestGeneration: action.requestGeneration,
      message: action.message,
    };
  }

  if (action.type === "overviewSucceeded") {
    return {
      status: "ready",
      workspacePath: action.workspacePath,
      cycleId: action.cycleId,
      requestGeneration: action.requestGeneration,
      overview: action.overview,
      detail: createDetailState(action.overview.files, action.selection),
    };
  }

  if (state.status !== "ready") {
    return state;
  }

  if (action.type === "selectionChanged") {
    return {
      ...state,
      detail: createDetailState(state.overview.files, action.selection),
    };
  }

  if (
    state.detail.status !== "loading" ||
    state.detail.fileId !== action.fileId
  ) {
    return state;
  }

  if (action.type === "detailSucceeded") {
    return {
      ...state,
      detail: { status: "ready", fileId: action.fileId, value: action.value },
    };
  }

  return {
    ...state,
    detail: {
      status: "failed",
      fileId: action.fileId,
      message: action.message,
    },
  };
}

/**
 * Derives the initial detail state for a newly resolved overview and
 * selection pair.
 *
 * @param files - Changed Spec files from the current overview.
 * @param selection - Shared Markdown and Diff logical file selection.
 * @returns "unchanged" when nothing is selected or the selection has no
 *   diff, otherwise "loading" for the matching file's ID.
 */
function createDetailState(
  files: readonly SpecChange[],
  selection: SpecDiffSelection,
): SpecDiffDetailState {
  const selectedChange = findSpecChange(files, selection);
  if (selectedChange === null) {
    return { status: "unchanged" };
  }

  return { status: "loading", fileId: createSpecChangeId(selectedChange) };
}

/**
 * Determines whether an incoming action's request identity still matches
 * the state's in-flight (or last completed) request, so stale results from
 * superseded requests are discarded.
 *
 * @param state - Current immutable workspace state.
 * @param action - The request identity carried by an incoming action.
 * @returns False for the idle state or a mismatched identity; true
 *   otherwise.
 */
function isCurrentRequest(
  state: SpecDiffWorkspaceState,
  action: RequestIdentity,
): boolean {
  if (state.status === "idle") {
    return false;
  }

  return (
    state.workspacePath === action.workspacePath &&
    state.cycleId === action.cycleId &&
    state.requestGeneration === action.requestGeneration
  );
}
