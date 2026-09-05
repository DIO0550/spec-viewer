import {
  normalizeWorkspacePath,
  parseRecentWorkspaces,
  type RecentWorkspace,
} from "@/utils/recentWorkspaces";

export type RecentWorkspaceStorage = Pick<
  Storage,
  "getItem" | "removeItem" | "setItem"
>;

const recentWorkspaceStorageKey = "spec-reviewer.recent-workspaces";
const lastActiveWorkspaceStorageKey = "spec-reviewer.last-active-workspace";

/** @returns Recent workspaces loaded from browser storage, or an empty list. */
export function readRecentWorkspaces(
  storage: RecentWorkspaceStorage | null = getBrowserStorage(),
): readonly RecentWorkspace[] {
  if (storage === null) {
    return [];
  }

  try {
    return parseRecentWorkspaces(storage.getItem(recentWorkspaceStorageKey));
  } catch {
    return [];
  }
}

/** @returns The last active workspace path stored in browser storage. */
export function readLastActiveWorkspacePath(
  storage: RecentWorkspaceStorage | null = getBrowserStorage(),
): string | null {
  if (storage === null) {
    return null;
  }

  try {
    return normalizeWorkspacePath(
      storage.getItem(lastActiveWorkspaceStorageKey) ?? "",
    );
  } catch {
    return null;
  }
}

/** Persists the last active workspace path when browser storage is available. */
export function writeLastActiveWorkspacePath(
  path: string,
  storage: RecentWorkspaceStorage | null = getBrowserStorage(),
): void {
  if (storage === null) {
    return;
  }

  const normalizedPath = normalizeWorkspacePath(path);

  if (normalizedPath === null) {
    clearLastActiveWorkspacePath(storage);
    return;
  }

  try {
    storage.setItem(lastActiveWorkspaceStorageKey, normalizedPath);
  } catch {
    return;
  }
}

/** Removes the persisted last active workspace path. */
export function clearLastActiveWorkspacePath(
  storage: RecentWorkspaceStorage | null = getBrowserStorage(),
): void {
  if (storage === null) {
    return;
  }

  try {
    storage.removeItem(lastActiveWorkspaceStorageKey);
  } catch {
    return;
  }
}

/** Persists recent workspaces when browser storage is available. */
export function writeRecentWorkspaces(
  workspaces: readonly RecentWorkspace[],
  storage: RecentWorkspaceStorage | null = getBrowserStorage(),
): void {
  if (storage === null) {
    return;
  }

  try {
    storage.setItem(recentWorkspaceStorageKey, JSON.stringify(workspaces));
  } catch {
    return;
  }
}

/** Removes the persisted recent workspace list. */
export function clearStoredRecentWorkspaces(
  storage: RecentWorkspaceStorage | null = getBrowserStorage(),
): void {
  if (storage === null) {
    return;
  }

  try {
    storage.removeItem(recentWorkspaceStorageKey);
  } catch {
    return;
  }
}

/** @returns The browser's `localStorage`, or null outside a browser environment. */
function getBrowserStorage(): RecentWorkspaceStorage | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage;
}
