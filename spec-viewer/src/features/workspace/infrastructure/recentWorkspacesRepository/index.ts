import type { RecentWorkspacesClock } from "@/features/workspace/application/ports/recentWorkspacesClock";
import type { RecentWorkspacesRepository } from "@/features/workspace/application/ports/recentWorkspacesRepository";
import {
  RecentWorkspaces,
  type RecentWorkspaces as RecentWorkspacesValue,
} from "@/features/workspace/domain/recentWorkspaces";
import {
  decodeRecentWorkspaces,
  encodeRecentWorkspaces,
} from "@/features/workspace/infrastructure/recentWorkspacesCodec";

export type RecentWorkspaceStorage = Pick<
  Storage,
  "getItem" | "removeItem" | "setItem"
>;

const recentWorkspaceStorageKey = "spec-reviewer.recent-workspaces";
const lastActiveWorkspaceStorageKey = "spec-reviewer.last-active-workspace";

/**
 * @param storage - Browser-compatible key-value storage, or null when unavailable.
 * @returns A repository that persists the current keys and data format.
 */
export function createLocalStorageRecentWorkspacesRepository(
  storage: RecentWorkspaceStorage | null,
): RecentWorkspacesRepository {
  return {
    load: () => loadRecentWorkspaces(storage),
    save: (recentWorkspaces) => {
      saveRecentWorkspaces(storage, recentWorkspaces);
    },
    clear: () => {
      clearRecentWorkspaces(storage);
    },
  };
}

/** @returns A recent-workspaces repository backed by browser localStorage. */
export function createBrowserRecentWorkspacesRepository(): RecentWorkspacesRepository {
  return createLocalStorageRecentWorkspacesRepository(getBrowserStorage());
}

/** @returns A system clock suitable for recent-workspace recording. */
export function createRecentWorkspacesSystemClock(): RecentWorkspacesClock {
  return {
    now: () => new Date().toISOString(),
  };
}

/** @returns A safe aggregate loaded from storage. */
function loadRecentWorkspaces(
  storage: RecentWorkspaceStorage | null,
): RecentWorkspacesValue {
  if (storage === null) {
    return RecentWorkspaces.empty();
  }

  return decodeRecentWorkspaces({
    entriesJson: readStorageValue(storage, recentWorkspaceStorageKey),
    lastActiveWorkspacePath: readStorageValue(
      storage,
      lastActiveWorkspaceStorageKey,
    ),
  });
}

/** Persists an aggregate using the current storage keys. */
function saveRecentWorkspaces(
  storage: RecentWorkspaceStorage | null,
  recentWorkspaces: RecentWorkspacesValue,
): void {
  if (storage === null) {
    return;
  }

  const encoded = encodeRecentWorkspaces(recentWorkspaces);
  writeStorageValue(storage, recentWorkspaceStorageKey, encoded.entriesJson);

  if (encoded.lastActiveWorkspacePath === null) {
    removeStorageValue(storage, lastActiveWorkspaceStorageKey);
    return;
  }

  writeStorageValue(
    storage,
    lastActiveWorkspaceStorageKey,
    encoded.lastActiveWorkspacePath,
  );
}

/** Removes both current storage keys. */
function clearRecentWorkspaces(storage: RecentWorkspaceStorage | null): void {
  if (storage === null) {
    return;
  }

  removeStorageValue(storage, recentWorkspaceStorageKey);
  removeStorageValue(storage, lastActiveWorkspaceStorageKey);
}

/** @returns The localStorage object when accessible in a browser. */
function getBrowserStorage(): RecentWorkspaceStorage | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** @returns A storage value, or null when browser I/O fails. */
function readStorageValue(
  storage: RecentWorkspaceStorage,
  key: string,
): string | null {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

/** Writes a storage value while containing browser I/O failures. */
function writeStorageValue(
  storage: RecentWorkspaceStorage,
  key: string,
  value: string,
): void {
  try {
    storage.setItem(key, value);
  } catch {
    return;
  }
}

/** Removes a storage value while containing browser I/O failures. */
function removeStorageValue(
  storage: RecentWorkspaceStorage,
  key: string,
): void {
  try {
    storage.removeItem(key);
  } catch {
    return;
  }
}
