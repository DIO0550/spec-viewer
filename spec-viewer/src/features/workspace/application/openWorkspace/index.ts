import type { Workspace } from "@/features/workspace/domain/workspace";
import {
  WorkspacePath,
  type WorkspacePathParseError,
  type WorkspacePath as WorkspacePathValue,
} from "@/features/workspace/domain/workspacePath";

export type WorkspaceOpenSource =
  | "input"
  | "browse"
  | "drop"
  | "recent"
  | "startupRestore";

export type WorkspaceOpenAvailability = Readonly<{
  isWorkspaceOpening: boolean;
  isBrowsingWorkspace: boolean;
}>;

export type OpenWorkspaceCommand =
  | Readonly<{ type: "input"; rawPath: string }>
  | Readonly<{ type: "browse"; rawPath: string }>
  | Readonly<{
      type: "drop";
      path: WorkspacePathValue;
      availability: WorkspaceOpenAvailability;
    }>
  | Readonly<{
      type: "recent" | "startupRestore";
      path: WorkspacePathValue;
      activeWorkspaceRoot: WorkspacePathValue | null;
      availability: WorkspaceOpenAvailability;
    }>;

export type OpenWorkspaceOutcome =
  | Readonly<{
      type: "loaded";
      source: WorkspaceOpenSource;
      path: WorkspacePathValue;
    }>
  | Readonly<{
      type: "loadFailedSilently";
      source: Exclude<WorkspaceOpenSource, "recent" | "startupRestore">;
    }>
  | Readonly<{
      type: "loadCanceled";
      source: WorkspaceOpenSource;
    }>
  | Readonly<{
      type: "skipped";
      source: "drop" | "recent" | "startupRestore";
    }>
  | Readonly<{
      type: "rejected";
      source: "input" | "browse";
      reason: "missingPath" | "invalidPath";
      error: WorkspacePathParseError;
    }>
  | Readonly<{
      type: "rejected";
      source: "drop";
      reason: "notDirectory";
    }>
  | Readonly<{
      type: "validationFailed";
      source: "drop";
      cause: unknown;
    }>
  | Readonly<{
      type: "recentRemoved";
      source: "recent" | "startupRestore";
      reason: "missing" | "unsupported" | "validationFailed";
      cause?: unknown;
      removedPath: WorkspacePathValue;
      rollbackPath: WorkspacePathValue | null;
    }>;

export type OpenWorkspaceLoadOptions = Readonly<{
  preserveCurrentWorkspace: boolean;
}>;

export type OpenWorkspaceLoadOutcome =
  | Readonly<{ type: "loaded"; workspace: Workspace }>
  | Readonly<{ type: "unsupported" }>
  | Readonly<{ type: "canceled" }>;

export type OpenWorkspacePorts = Readonly<{
  /** @returns Whether the path currently identifies a directory. */
  validate: (
    path: WorkspacePathValue,
  ) => Promise<Readonly<{ isDirectory: boolean }>>;
  /** @returns A loaded, unsupported, or canceled workspace outcome. */
  load: (
    path: WorkspacePathValue,
    options: OpenWorkspaceLoadOptions,
  ) => Promise<OpenWorkspaceLoadOutcome>;
  recentWorkspaces: Readonly<{
    /** Records a successfully loaded workspace. */
    record: (workspace: Workspace) => Promise<void>;
    /** Removes an unavailable saved path before a rollback outcome is returned. */
    remove: (path: WorkspacePathValue) => Promise<void>;
  }>;
}>;

export type OpenWorkspaceUseCase = (
  command: OpenWorkspaceCommand,
) => Promise<OpenWorkspaceOutcome>;

/**
 * @param ports - Validation, loading, and recent-workspace boundaries.
 * @returns A framework-independent workspace open command handler.
 */
export function createOpenWorkspaceUseCase(
  ports: OpenWorkspacePorts,
): OpenWorkspaceUseCase {
  return async (command): Promise<OpenWorkspaceOutcome> => {
    if (command.type === "input" || command.type === "browse") {
      return openRawPath(command, ports);
    }

    if (isWorkspaceOpenGuarded(command.availability)) {
      return { type: "skipped", source: command.type };
    }

    if (command.type === "drop") {
      return openDroppedPath(command.path, ports);
    }

    return openSavedPath(command, ports);
  };
}

/**
 * @param availability - Current workspace and browse activity.
 * @returns True when a guarded command must be skipped.
 */
export function isWorkspaceOpenGuarded(
  availability: WorkspaceOpenAvailability,
): boolean {
  return availability.isWorkspaceOpening || availability.isBrowsingWorkspace;
}

/**
 * @param command - Input or browse command containing an untrusted path.
 * @param ports - Workspace open boundaries.
 * @returns The result of opening an input or browse path.
 */
async function openRawPath(
  command: Extract<OpenWorkspaceCommand, { type: "input" | "browse" }>,
  ports: OpenWorkspacePorts,
): Promise<OpenWorkspaceOutcome> {
  const parsedPath = WorkspacePath.parse(command.rawPath);

  if (!parsedPath.ok) {
    return {
      type: "rejected",
      source: command.type,
      reason:
        parsedPath.error.reason === "missingWorkspacePath"
          ? "missingPath"
          : "invalidPath",
      error: parsedPath.error,
    };
  }

  return loadWorkspace(parsedPath.path, command.type, false, ports);
}

/**
 * @param path - Canonical dropped workspace path.
 * @param ports - Workspace open boundaries.
 * @returns The result of validating and opening a dropped path.
 */
async function openDroppedPath(
  path: WorkspacePathValue,
  ports: OpenWorkspacePorts,
): Promise<OpenWorkspaceOutcome> {
  let validation: Readonly<{ isDirectory: boolean }>;

  try {
    validation = await ports.validate(path);
  } catch (cause) {
    return { type: "validationFailed", source: "drop", cause };
  }

  if (!validation.isDirectory) {
    return { type: "rejected", source: "drop", reason: "notDirectory" };
  }

  return loadWorkspace(path, "drop", true, ports);
}

/**
 * @param command - Recent or startup restore command.
 * @param ports - Workspace open boundaries.
 * @returns The result of validating and restoring a saved path.
 */
async function openSavedPath(
  command: Extract<OpenWorkspaceCommand, { type: "recent" | "startupRestore" }>,
  ports: OpenWorkspacePorts,
): Promise<OpenWorkspaceOutcome> {
  let validation: Readonly<{ isDirectory: boolean }>;

  try {
    validation = await ports.validate(command.path);
  } catch (cause) {
    return removeSavedPath(command, "validationFailed", ports, cause);
  }

  if (!validation.isDirectory) {
    return removeSavedPath(command, "missing", ports);
  }

  const loadOutcome = await ports.load(command.path, {
    preserveCurrentWorkspace: true,
  });

  if (loadOutcome.type === "canceled") {
    return { type: "loadCanceled", source: command.type };
  }

  if (loadOutcome.type === "unsupported") {
    return removeSavedPath(command, "unsupported", ports);
  }

  await ports.recentWorkspaces.record(loadOutcome.workspace);
  return {
    type: "loaded",
    source: command.type,
    path: command.path,
  };
}

/**
 * @param path - Canonical path to load.
 * @param source - Command source used by the outcome.
 * @param preserveCurrentWorkspace - Whether failed loading keeps the active workspace.
 * @param ports - Workspace open boundaries.
 * @returns Loaded or silent failure after applying the preservation policy.
 */
async function loadWorkspace(
  path: WorkspacePathValue,
  source: "input" | "browse" | "drop",
  preserveCurrentWorkspace: boolean,
  ports: OpenWorkspacePorts,
): Promise<OpenWorkspaceOutcome> {
  const loadOutcome = await ports.load(path, { preserveCurrentWorkspace });

  if (loadOutcome.type === "canceled") {
    return { type: "loadCanceled", source };
  }

  if (loadOutcome.type === "unsupported") {
    return { type: "loadFailedSilently", source };
  }

  await ports.recentWorkspaces.record(loadOutcome.workspace);
  return { type: "loaded", source, path };
}

/**
 * @param command - Saved workspace command that could not be completed.
 * @param reason - Application reason for removing the saved path.
 * @param ports - Workspace open boundaries.
 * @param cause - Optional validation boundary failure.
 * @returns A rollback-ready outcome after repository removal completes.
 */
async function removeSavedPath(
  command: Extract<OpenWorkspaceCommand, { type: "recent" | "startupRestore" }>,
  reason: "missing" | "unsupported" | "validationFailed",
  ports: OpenWorkspacePorts,
  cause?: unknown,
): Promise<OpenWorkspaceOutcome> {
  await ports.recentWorkspaces.remove(command.path);

  return {
    type: "recentRemoved",
    source: command.type,
    reason,
    ...(cause === undefined ? {} : { cause }),
    removedPath: command.path,
    rollbackPath: command.activeWorkspaceRoot,
  };
}
