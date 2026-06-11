export type WorkspaceDropCandidate =
  | Readonly<{
      status: "accepted";
      path: string;
    }>
  | Readonly<{
      status: "rejected";
      message: string;
    }>;

const multipleDropMessage = "Drop a single workspace folder.";
const missingPathDropMessage =
  "Drop a workspace folder or paste a filesystem path.";

/** @returns A validated single workspace path candidate from dropped paths. */
export function createWorkspaceDropCandidate(
  paths: readonly string[],
): WorkspaceDropCandidate {
  const trimmedPaths = paths
    .map((path) => path.trim())
    .filter((path) => path.length > 0);

  if (trimmedPaths.length === 1) {
    return {
      status: "accepted",
      path: trimmedPaths[0] ?? "",
    };
  }

  if (trimmedPaths.length > 1) {
    return {
      status: "rejected",
      message: multipleDropMessage,
    };
  }

  return {
    status: "rejected",
    message: missingPathDropMessage,
  };
}

/** @returns Filesystem path strings that can be read from a browser drop. */
export function extractBrowserDropPaths(
  dataTransfer: DataTransfer | null,
): readonly string[] {
  if (dataTransfer === null) {
    return [];
  }

  const textPath = normalizeDroppedTextPath(dataTransfer.getData("text/plain"));

  if (textPath !== null) {
    return [textPath];
  }

  return Array.from(dataTransfer.files)
    .map(readDroppedFilePath)
    .filter((path): path is string => path !== null);
}

/**
 * @param rawPath - Raw text payload from the drop event
 * @returns A filesystem path from a plain-text drop, when present.
 */
function normalizeDroppedTextPath(rawPath: string): string | null {
  const trimmedPath = rawPath.trim();

  if (trimmedPath.length === 0) {
    return null;
  }

  if (!trimmedPath.startsWith("file://")) {
    return trimmedPath;
  }

  try {
    return decodeURIComponent(new URL(trimmedPath).pathname);
  } catch {
    return trimmedPath;
  }
}

/**
 * @param file - Dropped File object that may carry a Tauri path
 * @returns A Tauri-provided file path from a dropped File object, when present.
 */
function readDroppedFilePath(file: File): string | null {
  const path = readStringProperty(file, "path");

  if (path !== null && path.trim().length > 0) {
    return path;
  }

  return null;
}

/**
 * @param value - Object to read from
 * @param key - Property name to read
 * @returns A string property from an unknown object shape.
 */
function readStringProperty(value: unknown, key: string): string | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const property = record[key];

  if (typeof property !== "string") {
    return null;
  }

  return property;
}
