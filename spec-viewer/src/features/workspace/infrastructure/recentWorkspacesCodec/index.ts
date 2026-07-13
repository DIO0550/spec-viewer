import {
  RecentWorkspaces,
  type RecentWorkspace,
  type RecentWorkspaces as RecentWorkspacesValue,
} from "@/features/workspace/domain/recentWorkspaces";
import type { WorkspaceKind } from "@/features/workspace/domain/workspace";
import {
  WorkspacePath,
  type WorkspacePath as WorkspacePathValue,
} from "@/features/workspace/domain/workspacePath";

export type DecodeRecentWorkspacesInput = Readonly<{
  entriesJson: string | null;
  lastActiveWorkspacePath: string | null;
}>;

export type EncodedRecentWorkspaces = Readonly<{
  entriesJson: string;
  lastActiveWorkspacePath: string | null;
}>;

/**
 * @param input - Raw values read from the current browser-storage keys.
 * @returns A safe aggregate decoded from current or legacy persisted data.
 */
export function decodeRecentWorkspaces(
  input: DecodeRecentWorkspacesInput,
): RecentWorkspacesValue {
  const parsedEntries = parseEntriesJson(input.entriesJson);
  const entries = Array.isArray(parsedEntries)
    ? parsedEntries.flatMap((value) => {
        const entry = decodeRecentWorkspace(value);
        return entry === null ? [] : [entry];
      })
    : [];

  return RecentWorkspaces.restore({
    entries,
    lastActiveWorkspacePath: decodeWorkspacePath(input.lastActiveWorkspacePath),
  });
}

/**
 * @param recentWorkspaces - Aggregate ready to persist.
 * @returns Values encoded with the existing browser-storage data format.
 */
export function encodeRecentWorkspaces(
  recentWorkspaces: RecentWorkspacesValue,
): EncodedRecentWorkspaces {
  return {
    entriesJson: JSON.stringify(recentWorkspaces.entries),
    lastActiveWorkspacePath:
      recentWorkspaces.lastActiveWorkspacePath === null
        ? null
        : WorkspacePath.toString(recentWorkspaces.lastActiveWorkspacePath),
  };
}

/**
 * @param rawValue - Raw JSON text from storage.
 * @returns Parsed unknown data, or an empty list for missing/corrupt JSON.
 */
function parseEntriesJson(rawValue: string | null): unknown {
  if (rawValue === null) {
    return [];
  }

  try {
    return JSON.parse(rawValue) as unknown;
  } catch {
    return [];
  }
}

/**
 * @param value - Unknown current or legacy persisted entry.
 * @returns A normalized recent workspace when the path is valid.
 */
function decodeRecentWorkspace(value: unknown): RecentWorkspace | null {
  if (typeof value === "string") {
    const path = decodeWorkspacePath(value);

    return path === null
      ? null
      : {
          path,
          displayName: WorkspacePath.displayName(path),
          kind: "plugin-workspace",
          lastOpenedAt: "",
        };
  }

  if (!isUnknownRecord(value) || typeof value.path !== "string") {
    return null;
  }

  const path = decodeWorkspacePath(value.path);

  if (path === null) {
    return null;
  }

  const lastOpenedAt = decodeLastOpenedAt(value);

  if (lastOpenedAt === null) {
    return null;
  }

  return {
    path,
    displayName: decodeDisplayName(value.displayName, path),
    kind: isWorkspaceKind(value.kind) ? value.kind : "plugin-workspace",
    lastOpenedAt,
  };
}

/**
 * @param value - Unknown path value from storage.
 * @returns A canonical path or null when invalid.
 */
function decodeWorkspacePath(value: unknown): WorkspacePathValue | null {
  if (typeof value !== "string") {
    return null;
  }

  const parsedPath = WorkspacePath.parse(value);
  return parsedPath.ok ? parsedPath.path : null;
}

/**
 * @param value - Unknown display-name value from storage.
 * @param path - Canonical path used for the legacy fallback.
 * @returns A trimmed display name.
 */
function decodeDisplayName(value: unknown, path: WorkspacePathValue): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    return WorkspacePath.displayName(path);
  }

  return value.trim();
}

/**
 * @param value - Unknown persisted entry record.
 * @returns The current timestamp or the legacy openedAt value.
 */
function decodeLastOpenedAt(
  value: Readonly<Record<string, unknown>>,
): string | null {
  const timestamp =
    typeof value.lastOpenedAt === "string"
      ? value.lastOpenedAt
      : value.openedAt;

  if (timestamp === undefined) {
    return "";
  }

  return isPersistedTimestamp(timestamp) ? timestamp : null;
}

/** @returns Whether a value is an ISO timestamp or the legacy empty marker. */
function isPersistedTimestamp(value: unknown): value is string {
  if (value === "") {
    return true;
  }

  if (typeof value !== "string") {
    return false;
  }

  const parsedTimestamp = Date.parse(value);

  return (
    Number.isFinite(parsedTimestamp) &&
    new Date(parsedTimestamp).toISOString() === value
  );
}

/** @returns Whether a value is a non-null object record. */
function isUnknownRecord(
  value: unknown,
): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null;
}

/** @returns Whether a value is a supported workspace kind. */
function isWorkspaceKind(value: unknown): value is WorkspaceKind {
  return (
    value === "plugin-workspace" ||
    value === "plugin-worktree" ||
    value === "spec-skill"
  );
}
