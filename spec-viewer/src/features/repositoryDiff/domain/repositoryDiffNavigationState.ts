import type { RepositoryDiffFilter } from "./repositoryDiff";

export type RepositoryDiffNavigationEntry = Readonly<{
  filter: RepositoryDiffFilter;
  selectedPath: string | null;
  expandedPaths: readonly string[];
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
  | Readonly<{
      type: "pathSelected";
      key: string;
      path: string | null;
    }>
  | Readonly<{
      type: "directoryToggled";
      key: string;
      path: string;
    }>
  | Readonly<{
      type: "reconciled";
      key: string;
      visiblePaths: readonly string[];
      directoryPaths: readonly string[];
    }>;

/**
 * Creates the default navigation entry for an unvisited repository.
 *
 * @returns A Changed entry with no selection or expanded directory.
 */
export function createInitialRepositoryDiffNavigationEntry(): RepositoryDiffNavigationEntry {
  return {
    filter: "changed",
    selectedPath: null,
    expandedPaths: [],
  };
}

/**
 * Creates the in-memory navigation state for one application session.
 *
 * @returns An empty navigation state.
 */
export function createInitialRepositoryDiffNavigationState(): RepositoryDiffNavigationState {
  return { entriesByKey: {} };
}

/**
 * Reduces repository navigation actions without mutating the previous state.
 *
 * @param state - Current repository navigation state.
 * @param action - Navigation operation to apply.
 * @returns The next immutable navigation state.
 */
export function reduceRepositoryDiffNavigationState(
  state: RepositoryDiffNavigationState,
  action: RepositoryDiffNavigationAction,
): RepositoryDiffNavigationState {
  const entry =
    state.entriesByKey[action.key] ??
    createInitialRepositoryDiffNavigationEntry();
  const nextEntry = reduceEntry(entry, action);

  if (nextEntry === entry && state.entriesByKey[action.key] !== undefined) {
    return state;
  }

  return {
    entriesByKey: {
      ...state.entriesByKey,
      [action.key]: nextEntry,
    },
  };
}

function reduceEntry(
  entry: RepositoryDiffNavigationEntry,
  action: RepositoryDiffNavigationAction,
): RepositoryDiffNavigationEntry {
  if (action.type === "filterChanged") {
    if (entry.filter === action.filter) {
      return entry;
    }

    return { ...entry, filter: action.filter };
  }

  if (action.type === "pathSelected") {
    const selectedPath = normalizePath(action.path);
    if (entry.selectedPath === selectedPath) {
      return entry;
    }

    return { ...entry, selectedPath };
  }

  if (action.type === "directoryToggled") {
    const path = normalizePath(action.path);
    if (path === null) {
      return entry;
    }

    const expandedPaths = entry.expandedPaths.includes(path)
      ? entry.expandedPaths.filter((candidate) => candidate !== path)
      : [...entry.expandedPaths, path];

    return { ...entry, expandedPaths };
  }

  const visiblePaths = new Set(action.visiblePaths.map(normalizePathValue));
  const directoryPaths = new Set(action.directoryPaths.map(normalizePathValue));
  const selectedPath =
    entry.selectedPath !== null && visiblePaths.has(entry.selectedPath)
      ? entry.selectedPath
      : null;
  const expandedPaths = entry.expandedPaths.filter((path) =>
    directoryPaths.has(path),
  );

  if (
    selectedPath === entry.selectedPath &&
    expandedPaths.length === entry.expandedPaths.length
  ) {
    return entry;
  }

  return { ...entry, selectedPath, expandedPaths };
}

function normalizePath(path: string | null): string | null {
  if (path === null) {
    return null;
  }

  const normalized = normalizePathValue(path);
  const segments = normalized.split("/");
  return normalized === "" || normalized === "." || segments.includes("..")
    ? null
    : normalized;
}

function normalizePathValue(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/+/g, "/");
}
