import type {
  Workspace,
  WorkspaceKind,
} from "@/features/workspace/domain/workspace";
import {
  WorkspacePath,
  type WorkspacePath as WorkspacePathValue,
} from "@/features/workspace/domain/workspacePath";

export const recentWorkspaceLimit = 8;

export type RecentWorkspace = Readonly<{
  path: WorkspacePathValue;
  displayName: string;
  kind: WorkspaceKind;
  lastOpenedAt: string;
}>;

export type RecentWorkspaces = Readonly<{
  entries: readonly RecentWorkspace[];
  lastActiveWorkspacePath: WorkspacePathValue | null;
}>;

export type RestoreRecentWorkspacesInput = Readonly<{
  entries: readonly RecentWorkspace[];
  lastActiveWorkspacePath: WorkspacePathValue | null;
}>;

/** @returns An empty recent-workspaces aggregate. */
function empty(): RecentWorkspaces {
  return {
    entries: [],
    lastActiveWorkspacePath: null,
  };
}

/**
 * @param input - Decoded entries and last-active path from a repository.
 * @returns A recent-workspaces aggregate with all invariants restored.
 */
function restore(input: RestoreRecentWorkspacesInput): RecentWorkspaces {
  const entries = dedupeByPath(sortByNewest(input.entries)).slice(
    0,
    recentWorkspaceLimit,
  );
  const lastActiveWorkspacePath = includesPath(
    entries,
    input.lastActiveWorkspacePath,
  )
    ? input.lastActiveWorkspacePath
    : null;

  return { entries, lastActiveWorkspacePath };
}

/**
 * @param current - Current recent-workspaces aggregate.
 * @param workspace - Successfully opened workspace to record.
 * @param lastOpenedAt - Timestamp supplied by an application clock.
 * @returns A new aggregate with the workspace first and marked last active.
 */
function record(
  current: RecentWorkspaces,
  workspace: Workspace,
  lastOpenedAt: string,
): RecentWorkspaces {
  const newestLastOpenedAt = current.entries[0]?.lastOpenedAt ?? "";
  const monotonicLastOpenedAt =
    lastOpenedAt < newestLastOpenedAt ? newestLastOpenedAt : lastOpenedAt;
  const recentWorkspace: RecentWorkspace = {
    path: workspace.root,
    displayName: WorkspacePath.displayName(workspace.root),
    kind: workspace.kind,
    lastOpenedAt: monotonicLastOpenedAt,
  };
  const otherEntries = current.entries.filter(
    ({ path }) => !WorkspacePath.equals(path, workspace.root),
  );

  return restore({
    entries: [recentWorkspace, ...otherEntries],
    lastActiveWorkspacePath: workspace.root,
  });
}

/**
 * @param current - Current recent-workspaces aggregate.
 * @param path - Canonical workspace path to remove.
 * @returns A new aggregate without the path and with coherent last-active state.
 */
function remove(
  current: RecentWorkspaces,
  path: WorkspacePathValue,
): RecentWorkspaces {
  const entries = current.entries.filter(
    (workspace) => !WorkspacePath.equals(workspace.path, path),
  );
  const removesLastActive =
    current.lastActiveWorkspacePath !== null &&
    WorkspacePath.equals(current.lastActiveWorkspacePath, path);

  return {
    entries,
    lastActiveWorkspacePath: removesLastActive
      ? null
      : current.lastActiveWorkspacePath,
  };
}

/** @returns An empty recent-workspaces aggregate. */
function clear(): RecentWorkspaces {
  return empty();
}

/** @returns Entries with canonical duplicate paths removed. */
function dedupeByPath(
  entries: readonly RecentWorkspace[],
): readonly RecentWorkspace[] {
  const dedupedEntries: RecentWorkspace[] = [];

  for (const entry of entries) {
    if (includesPath(dedupedEntries, entry.path)) {
      continue;
    }

    dedupedEntries.push(entry);
  }

  return dedupedEntries;
}

/** @returns Entries ordered by timestamp descending with stable ties. */
function sortByNewest(
  entries: readonly RecentWorkspace[],
): readonly RecentWorkspace[] {
  return entries
    .map((entry, index) => ({ entry, index }))
    .sort((left, right) => {
      if (left.entry.lastOpenedAt === right.entry.lastOpenedAt) {
        return left.index - right.index;
      }

      return left.entry.lastOpenedAt > right.entry.lastOpenedAt ? -1 : 1;
    })
    .map(({ entry }) => entry);
}

/** @returns Whether entries contain the provided path. */
function includesPath(
  entries: readonly RecentWorkspace[],
  path: WorkspacePathValue | null,
): path is WorkspacePathValue {
  if (path === null) {
    return false;
  }

  return entries.some((entry) => WorkspacePath.equals(entry.path, path));
}

export const RecentWorkspaces = {
  clear,
  empty,
  record,
  remove,
  restore,
} as const;
