import type { FileReviewViewMode } from "@/features/diff/domain/fileDiff";
import type { RepositoryDiffFilter } from "./repositoryDiff";

export type RepositoryDiffNavigationEntry = Readonly<{
  filter: RepositoryDiffFilter;
  openPaths: readonly string[];
  activePath: string | null;
  expandedPaths: readonly string[];
  viewerMode: FileReviewViewMode;
  jumpTargetsByPath: Readonly<Record<string, string | null>>;
}>;

export type RepositoryDiffNavigationState = Readonly<{
  entriesByKey: Readonly<Record<string, RepositoryDiffNavigationEntry>>;
}>;

export type RepositoryDiffNavigationAction =
  | Readonly<{
      type: "filterChanged";
      key: string;
      filter: RepositoryDiffFilter;
    }>
  | Readonly<{ type: "directoryToggled"; key: string; path: string }>
  | Readonly<{ type: "pathOpened"; key: string; path: string }>
  | Readonly<{ type: "tabActivated"; key: string; path: string }>
  | Readonly<{ type: "tabClosed"; key: string; path: string }>
  | Readonly<{
      type: "viewerModeChanged";
      key: string;
      mode: FileReviewViewMode;
    }>
  | Readonly<{
      type: "jumpTargetChanged";
      key: string;
      path: string;
      changeId: string | null;
    }>
  | Readonly<{
      type: "reconciled";
      key: string;
      validFilePaths: readonly string[];
      directoryPaths: readonly string[];
    }>;

/**
 * Creates the default entry for an unvisited repository.
 *
 * @returns A Changed entry with no open files.
 */
export function createInitialRepositoryDiffNavigationEntry(): RepositoryDiffNavigationEntry {
  return {
    filter: "changed",
    openPaths: [],
    activePath: null,
    expandedPaths: [],
    viewerMode: "unified",
    jumpTargetsByPath: {},
  };
}

/**
 * Creates session-local repository navigation state.
 *
 * @returns Empty navigation state.
 */
export function createInitialRepositoryDiffNavigationState(): RepositoryDiffNavigationState {
  return { entriesByKey: {} };
}

/**
 * Applies one immutable navigation transition.
 *
 * @param state - Current state.
 * @param action - Key-scoped transition.
 * @returns Updated state or the original reference for a no-op.
 */
export function reduceRepositoryDiffNavigationState(
  state: RepositoryDiffNavigationState,
  action: RepositoryDiffNavigationAction,
): RepositoryDiffNavigationState {
  const entry =
    state.entriesByKey[action.key] ??
    createInitialRepositoryDiffNavigationEntry();
  const nextEntry = reduceEntry(entry, action);
  if (nextEntry === entry) {
    return state;
  }

  return {
    entriesByKey: { ...state.entriesByKey, [action.key]: nextEntry },
  };
}

/**
 * Chooses the right neighbor, then the left neighbor after a tab disappears.
 *
 * @param previous - Paths before removal.
 * @param remaining - Paths after removal.
 * @param closed - Removed active path.
 * @returns The fallback path, or null.
 */
export function selectCloseFallback(
  previous: readonly string[],
  remaining: readonly string[],
  closed: string,
): string | null {
  const index = previous.indexOf(closed);
  if (index < 0) {
    return null;
  }

  const candidates = previous
    .slice(index + 1)
    .concat(previous.slice(0, index).reverse());
  return candidates.find((path) => remaining.includes(path)) ?? null;
}

function reduceEntry(
  entry: RepositoryDiffNavigationEntry,
  action: RepositoryDiffNavigationAction,
): RepositoryDiffNavigationEntry {
  if (action.type === "filterChanged") {
    return entry.filter === action.filter
      ? entry
      : { ...entry, filter: action.filter };
  }
  if (action.type === "directoryToggled") {
    return toggleDirectory(entry, action.path);
  }
  if (action.type === "pathOpened") {
    return openPath(entry, action.path);
  }
  if (action.type === "tabActivated") {
    return activateTab(entry, action.path);
  }
  if (action.type === "tabClosed") {
    return closeTab(entry, action.path);
  }
  if (action.type === "viewerModeChanged") {
    return entry.viewerMode === action.mode
      ? entry
      : { ...entry, viewerMode: action.mode };
  }
  if (action.type === "jumpTargetChanged") {
    return changeJumpTarget(entry, action.path, action.changeId);
  }

  return reconcileEntry(entry, action.validFilePaths, action.directoryPaths);
}

function openPath(
  entry: RepositoryDiffNavigationEntry,
  rawPath: string,
): RepositoryDiffNavigationEntry {
  const path = normalizePath(rawPath);
  if (path === null) {
    return entry;
  }

  const isOpen = entry.openPaths.includes(path);
  if (isOpen && entry.activePath === path) {
    return entry;
  }

  return {
    ...entry,
    openPaths: isOpen ? entry.openPaths : [...entry.openPaths, path],
    activePath: path,
  };
}

function activateTab(
  entry: RepositoryDiffNavigationEntry,
  rawPath: string,
): RepositoryDiffNavigationEntry {
  const path = normalizePath(rawPath);
  if (
    path === null ||
    path === entry.activePath ||
    !entry.openPaths.includes(path)
  ) {
    return entry;
  }

  return { ...entry, activePath: path };
}

function closeTab(
  entry: RepositoryDiffNavigationEntry,
  rawPath: string,
): RepositoryDiffNavigationEntry {
  const path = normalizePath(rawPath);
  if (path === null || !entry.openPaths.includes(path)) {
    return entry;
  }

  const openPaths = entry.openPaths.filter((candidate) => candidate !== path);
  const activePath =
    entry.activePath === path
      ? selectCloseFallback(entry.openPaths, openPaths, path)
      : entry.activePath;
  return {
    ...entry,
    openPaths,
    activePath,
    jumpTargetsByPath: omitRecordKey(entry.jumpTargetsByPath, path),
  };
}

function changeJumpTarget(
  entry: RepositoryDiffNavigationEntry,
  rawPath: string,
  changeId: string | null,
): RepositoryDiffNavigationEntry {
  const path = normalizePath(rawPath);
  if (path === null || !entry.openPaths.includes(path)) {
    return entry;
  }

  const current = entry.jumpTargetsByPath[path] ?? null;
  if (current === changeId) {
    return entry;
  }

  const jumpTargetsByPath =
    changeId === null
      ? omitRecordKey(entry.jumpTargetsByPath, path)
      : { ...entry.jumpTargetsByPath, [path]: changeId };
  return { ...entry, jumpTargetsByPath };
}

function toggleDirectory(
  entry: RepositoryDiffNavigationEntry,
  rawPath: string,
): RepositoryDiffNavigationEntry {
  const path = normalizePath(rawPath);
  if (path === null) {
    return entry;
  }

  const expandedPaths = entry.expandedPaths.includes(path)
    ? entry.expandedPaths.filter((candidate) => candidate !== path)
    : [...entry.expandedPaths, path];
  return { ...entry, expandedPaths };
}

function reconcileEntry(
  entry: RepositoryDiffNavigationEntry,
  validFilePaths: readonly string[],
  directoryPaths: readonly string[],
): RepositoryDiffNavigationEntry {
  const validFiles = new Set(validFilePaths.map(normalizePathValue));
  const validDirectories = new Set(directoryPaths.map(normalizePathValue));
  const openPaths = entry.openPaths.filter((path) => validFiles.has(path));
  const expandedPaths = entry.expandedPaths.filter((path) =>
    validDirectories.has(path),
  );
  const activePath =
    entry.activePath === null || validFiles.has(entry.activePath)
      ? entry.activePath
      : selectCloseFallback(entry.openPaths, openPaths, entry.activePath);
  const jumpTargetsByPath = Object.fromEntries(
    Object.entries(entry.jumpTargetsByPath).filter(([path]) =>
      validFiles.has(path),
    ),
  );

  if (
    arraysEqual(openPaths, entry.openPaths) &&
    arraysEqual(expandedPaths, entry.expandedPaths) &&
    activePath === entry.activePath &&
    Object.keys(jumpTargetsByPath).length ===
      Object.keys(entry.jumpTargetsByPath).length
  ) {
    return entry;
  }

  return {
    ...entry,
    openPaths,
    activePath,
    expandedPaths,
    jumpTargetsByPath,
  };
}

function omitRecordKey(
  record: Readonly<Record<string, string | null>>,
  key: string,
): Readonly<Record<string, string | null>> {
  if (!(key in record)) {
    return record;
  }

  return Object.fromEntries(
    Object.entries(record).filter(([candidate]) => candidate !== key),
  );
}

function arraysEqual(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function normalizePath(path: string): string | null {
  const normalized = normalizePathValue(path);
  const segments = normalized.split("/");
  if (normalized === "" || normalized === "." || segments.includes("..")) {
    return null;
  }

  return normalized;
}

function normalizePathValue(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/+/g, "/");
}
