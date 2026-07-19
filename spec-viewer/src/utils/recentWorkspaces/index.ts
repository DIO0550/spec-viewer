import type {
  Workspace,
  WorkspaceKind,
} from "@/features/workspace/types/workspace";

export type RecentWorkspace = Readonly<{
  path: string;
  displayName: string;
  kind: WorkspaceKind;
  lastOpenedAt: string;
}>;

export const recentWorkspaceLimit = 8;

/** @returns A recent list with existing paths updated in place. */
export function recordRecentWorkspace(
  workspaces: readonly RecentWorkspace[],
  workspace: Workspace,
  lastOpenedAt = new Date().toISOString(),
): readonly RecentWorkspace[] {
  const normalizedPath = normalizeWorkspacePath(workspace.root);

  if (normalizedPath === null) {
    return workspaces;
  }

  const recentWorkspace = {
    path: normalizedPath,
    displayName: createWorkspaceDisplayName(normalizedPath),
    kind: workspace.kind,
    lastOpenedAt,
  };
  const existingIndex = workspaces.findIndex(
    (currentWorkspace) => currentWorkspace.path === normalizedPath,
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
  path: string,
): readonly RecentWorkspace[] {
  const normalizedPath = normalizeWorkspacePath(path);

  if (normalizedPath === null) {
    return workspaces;
  }

  return workspaces.filter((workspace) => workspace.path !== normalizedPath);
}

/** @returns Parsed and normalized recent workspaces from persisted JSON. */
export function parseRecentWorkspaces(
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

/** @returns A non-empty trimmed workspace path, or null for blank input. */
export function normalizeWorkspacePath(path: string): string | null {
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

/** @returns A supported recent workspace object from unknown storage data. */
export function normalizeRecentWorkspace(
  value: unknown,
): RecentWorkspace | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  if (
    !("path" in value) ||
    typeof value.path !== "string" ||
    !("displayName" in value) ||
    typeof value.displayName !== "string" ||
    value.displayName.trim().length === 0 ||
    !("kind" in value) ||
    !isWorkspaceKind(value.kind) ||
    !("lastOpenedAt" in value) ||
    typeof value.lastOpenedAt !== "string"
  ) {
    return null;
  }

  const path = normalizeWorkspacePath(value.path);

  if (path === null) {
    return null;
  }

  return {
    path,
    displayName: value.displayName.trim(),
    kind: value.kind,
    lastOpenedAt: value.lastOpenedAt,
  };
}

/** @returns A deduplicated recent workspace list preserving first occurrence. */
export function dedupeRecentWorkspaces(
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

/** @returns A readable display name for the workspace path. */
export function createWorkspaceDisplayName(path: string): string {
  const normalizedPath = path.replace(/[\\/]+$/, "");
  const pathParts = normalizedPath.split(/[\\/]/);
  const lastPart = pathParts[pathParts.length - 1];

  if (lastPart !== undefined && lastPart.length > 0) {
    return lastPart;
  }

  return path;
}

function isWorkspaceKind(value: unknown): value is WorkspaceKind {
  return value === "plugin-workspace" || value === "plugin-worktree";
}
