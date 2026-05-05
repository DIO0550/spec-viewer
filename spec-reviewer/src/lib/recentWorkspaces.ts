export type RecentWorkspace = Readonly<{
  path: string;
  openedAt: string;
}>;

export type RecentWorkspaceStorage = Pick<
  Storage,
  "getItem" | "removeItem" | "setItem"
>;

const recentWorkspaceStorageKey = "spec-reviewer.recent-workspaces";
export const recentWorkspaceLimit = 8;

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

/** @returns A recent list with the path moved to the front. */
export function recordRecentWorkspace(
  workspaces: readonly RecentWorkspace[],
  path: string,
  openedAt = new Date().toISOString(),
): readonly RecentWorkspace[] {
  const normalizedPath = normalizeWorkspacePath(path);

  if (normalizedPath === null) {
    return workspaces;
  }

  return dedupeRecentWorkspaces([
    { path: normalizedPath, openedAt },
    ...workspaces,
  ]).slice(0, recentWorkspaceLimit);
}

/** @returns A recent list without the given path. */
export function removeRecentWorkspace(
  workspaces: readonly RecentWorkspace[],
  path: string,
): readonly RecentWorkspace[] {
  const normalizedPath = normalizeWorkspacePath(path);

  if (normalizedPath === null) {
    return workspaces;
  }

  return workspaces.filter((workspace) => workspace.path !== normalizedPath);
}

/** @returns The localStorage object when running in a browser. */
function getBrowserStorage(): RecentWorkspaceStorage | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage;
}

/** @returns Parsed and normalized recent workspaces from persisted JSON. */
function parseRecentWorkspaces(
  rawValue: string | null,
): readonly RecentWorkspace[] {
  if (rawValue === null) {
    return [];
  }

  const parsedValue: unknown = JSON.parse(rawValue);

  if (!Array.isArray(parsedValue)) {
    return [];
  }

  return dedupeRecentWorkspaces(
    parsedValue.flatMap((value) => {
      const workspace = normalizeRecentWorkspace(value);
      return workspace === null ? [] : [workspace];
    }),
  ).slice(0, recentWorkspaceLimit);
}

/** @returns A supported recent workspace object from unknown storage data. */
function normalizeRecentWorkspace(value: unknown): RecentWorkspace | null {
  if (typeof value === "string") {
    const path = normalizeWorkspacePath(value);

    if (path === null) {
      return null;
    }

    return { path, openedAt: "" };
  }

  if (typeof value !== "object" || value === null) {
    return null;
  }

  if (!("path" in value) || typeof value.path !== "string") {
    return null;
  }

  const path = normalizeWorkspacePath(value.path);

  if (path === null) {
    return null;
  }

  const openedAt =
    "openedAt" in value && typeof value.openedAt === "string"
      ? value.openedAt
      : "";

  return { path, openedAt };
}

/** @returns A deduplicated recent workspace list preserving first occurrence. */
function dedupeRecentWorkspaces(
  workspaces: readonly RecentWorkspace[],
): readonly RecentWorkspace[] {
  const seenPaths = new Set<string>();
  const dedupedWorkspaces: RecentWorkspace[] = [];

  for (const workspace of workspaces) {
    if (seenPaths.has(workspace.path)) {
      continue;
    }

    seenPaths.add(workspace.path);
    dedupedWorkspaces.push(workspace);
  }

  return dedupedWorkspaces;
}

/** @returns A non-empty trimmed workspace path, or null for blank input. */
function normalizeWorkspacePath(path: string): string | null {
  const normalizedPath = path.trim();

  if (normalizedPath.length === 0) {
    return null;
  }

  return normalizedPath;
}
