import type { Workspace, WorkspaceKind } from "../types/workspace";

export type RecentWorkspace = Readonly<{
  path: string;
  displayName: string;
  kind: WorkspaceKind;
  lastOpenedAt: string;
}>;

export type RecentWorkspaceStorage = Pick<
  Storage,
  "getItem" | "removeItem" | "setItem"
>;

const recentWorkspaceStorageKey = "spec-reviewer.recent-workspaces";
const lastActiveWorkspaceStorageKey = "spec-reviewer.last-active-workspace";
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

/** @returns The last active workspace path stored in browser storage. */
export function readLastActiveWorkspacePath(
  storage: RecentWorkspaceStorage | null = getBrowserStorage(),
): string | null {
  if (storage === null) {
    return null;
  }

  try {
    const normalizedPath = normalizeWorkspacePath(
      storage.getItem(lastActiveWorkspaceStorageKey) ?? "",
    );
    return normalizedPath;
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

/** @returns A recent list with the path moved to the front. */
export function recordRecentWorkspace(
  workspaces: readonly RecentWorkspace[],
  workspace: Workspace,
  lastOpenedAt = new Date().toISOString(),
): readonly RecentWorkspace[] {
  const normalizedPath = normalizeWorkspacePath(workspace.root);

  if (normalizedPath === null) {
    return workspaces;
  }

  return dedupeRecentWorkspaces([
    {
      path: normalizedPath,
      displayName: createWorkspaceDisplayName(normalizedPath),
      kind: workspace.kind,
      lastOpenedAt,
    },
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

    return {
      path,
      displayName: createWorkspaceDisplayName(path),
      kind: "plugin-workspace",
      lastOpenedAt: "",
    };
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

  const displayName =
    "displayName" in value &&
    typeof value.displayName === "string" &&
    value.displayName.trim().length > 0
      ? value.displayName.trim()
      : createWorkspaceDisplayName(path);
  const kind =
    "kind" in value && isWorkspaceKind(value.kind)
      ? value.kind
      : "plugin-workspace";
  const legacyOpenedAt =
    "openedAt" in value && typeof value.openedAt === "string"
      ? value.openedAt
      : "";
  const lastOpenedAt =
    "lastOpenedAt" in value && typeof value.lastOpenedAt === "string"
      ? value.lastOpenedAt
      : legacyOpenedAt;

  return { path, displayName, kind, lastOpenedAt };
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
  const trimmedPath = path.trim();

  if (trimmedPath.length === 0) {
    return null;
  }

  const normalizedPath = trimmedPath.replace(/[\\/]+$/, "");

  if (normalizedPath.length === 0) {
    return trimmedPath;
  }

  return normalizedPath;
}

/** @returns A readable display name for the workspace path. */
function createWorkspaceDisplayName(path: string): string {
  const normalizedPath = path.replace(/[\\/]+$/, "");
  const pathParts = normalizedPath.split(/[\\/]/);
  const lastPart = pathParts[pathParts.length - 1];

  if (lastPart !== undefined && lastPart.length > 0) {
    return lastPart;
  }

  return path;
}

/** @returns True when the stored value is a supported workspace kind. */
function isWorkspaceKind(value: unknown): value is WorkspaceKind {
  return (
    value === "plugin-workspace" ||
    value === "plugin-worktree" ||
    value === "spec-skill"
  );
}
