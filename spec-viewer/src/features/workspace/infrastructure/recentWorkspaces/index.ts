import type {
  Workspace,
  WorkspaceKind,
} from "@/features/workspace/domain/workspace";
import {
  WorkspacePath,
  type WorkspacePath as WorkspacePathValue,
} from "@/features/workspace/domain/workspacePath";

export type RecentWorkspace = Readonly<{
  path: WorkspacePathValue;
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
): WorkspacePathValue | null {
  if (storage === null) {
    return null;
  }

  try {
    const parsedPath = WorkspacePath.parse(
      storage.getItem(lastActiveWorkspaceStorageKey) ?? "",
    );
    return parsedPath.ok ? parsedPath.path : null;
  } catch {
    return null;
  }
}

/** Persists the last active workspace path when browser storage is available. */
export function writeLastActiveWorkspacePath(
  path: WorkspacePathValue,
  storage: RecentWorkspaceStorage | null = getBrowserStorage(),
): void {
  if (storage === null) {
    return;
  }

  try {
    storage.setItem(
      lastActiveWorkspaceStorageKey,
      WorkspacePath.toString(path),
    );
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

/** @returns A recent list with existing paths updated in place. */
export function recordRecentWorkspace(
  workspaces: readonly RecentWorkspace[],
  workspace: Workspace,
  lastOpenedAt = new Date().toISOString(),
): readonly RecentWorkspace[] {
  const recentWorkspace = {
    path: workspace.root,
    displayName: WorkspacePath.displayName(workspace.root),
    kind: workspace.kind,
    lastOpenedAt,
  };
  const existingIndex = workspaces.findIndex((currentWorkspace) =>
    WorkspacePath.equals(currentWorkspace.path, workspace.root),
  );

  if (existingIndex >= 0) {
    return workspaces.map((currentWorkspace, index) =>
      index === existingIndex ? recentWorkspace : currentWorkspace,
    );
  }

  return dedupeRecentWorkspaces([recentWorkspace, ...workspaces]).slice(
    0,
    recentWorkspaceLimit,
  );
}

/** @returns A recent list without the given path. */
export function removeRecentWorkspace(
  workspaces: readonly RecentWorkspace[],
  path: WorkspacePathValue,
): readonly RecentWorkspace[] {
  return workspaces.filter(
    (workspace) => !WorkspacePath.equals(workspace.path, path),
  );
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

/**
 * @param value - 永続化ストレージから読み出した未知の値。
 * @returns A supported recent workspace object from unknown storage data.
 */
function normalizeRecentWorkspace(value: unknown): RecentWorkspace | null {
  if (typeof value === "string") {
    const parsedPath = WorkspacePath.parse(value);

    if (!parsedPath.ok) {
      return null;
    }

    return {
      path: parsedPath.path,
      displayName: WorkspacePath.displayName(parsedPath.path),
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

  const parsedPath = WorkspacePath.parse(value.path);

  if (!parsedPath.ok) {
    return null;
  }

  const displayName =
    "displayName" in value &&
    typeof value.displayName === "string" &&
    value.displayName.trim().length > 0
      ? value.displayName.trim()
      : WorkspacePath.displayName(parsedPath.path);
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

  return {
    path: parsedPath.path,
    displayName,
    kind,
    lastOpenedAt,
  };
}

/** @returns A deduplicated recent workspace list preserving first occurrence. */
function dedupeRecentWorkspaces(
  workspaces: readonly RecentWorkspace[],
): readonly RecentWorkspace[] {
  const dedupedWorkspaces: RecentWorkspace[] = [];

  for (const workspace of workspaces) {
    const isDuplicate = dedupedWorkspaces.some((currentWorkspace) =>
      WorkspacePath.equals(currentWorkspace.path, workspace.path),
    );

    if (isDuplicate) {
      continue;
    }

    dedupedWorkspaces.push(workspace);
  }

  return dedupedWorkspaces;
}

/**
 * @param value - 判定対象の未知の値。
 * @returns True when the stored value is a supported workspace kind.
 */
function isWorkspaceKind(value: unknown): value is WorkspaceKind {
  return (
    value === "plugin-workspace" ||
    value === "plugin-worktree" ||
    value === "spec-skill"
  );
}
