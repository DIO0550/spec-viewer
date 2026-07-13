declare const workspacePathBrand: unique symbol;

export type WorkspacePath = string & {
  readonly [workspacePathBrand]: true;
};

export type WorkspacePathParseError = Readonly<{
  reason: "missingWorkspacePath" | "invalidWorkspaceFileUrl";
}>;

export type WorkspacePathParseResult =
  | Readonly<{ ok: true; path: WorkspacePath }>
  | Readonly<{ ok: false; error: WorkspacePathParseError }>;

type FileUrlParseResult =
  | Readonly<{ ok: true; path: string }>
  | Readonly<{ ok: false }>;

const fileUrlPrefix = "file://";
const windowsFileUrlPathPattern = /^\/[a-zA-Z]:\//;
const windowsDriveRootPattern = /^[a-zA-Z]:\/$/;

export const WorkspacePath = {
  /**
   * @param value - Raw path received from input, storage, drop, or IPC.
   * @returns A canonical workspace path or a typed parse error.
   */
  parse(value: string): WorkspacePathParseResult {
    const trimmedPath = value.trim();

    if (trimmedPath.length === 0) {
      return {
        ok: false,
        error: { reason: "missingWorkspacePath" },
      };
    }

    const parsedFileUrl = parseFileUrl(trimmedPath);
    if (!parsedFileUrl.ok) {
      return {
        ok: false,
        error: { reason: "invalidWorkspaceFileUrl" },
      };
    }

    return {
      ok: true,
      path: normalizePath(parsedFileUrl.path) as WorkspacePath,
    };
  },

  /**
   * @param value - Validated workspace path.
   * @returns The canonical string used at UI and IPC boundaries.
   */
  toString(value: WorkspacePath): string {
    return value;
  },

  /**
   * @param left - First canonical workspace path.
   * @param right - Second canonical workspace path.
   * @returns Whether both paths identify the same canonical value.
   */
  equals(left: WorkspacePath, right: WorkspacePath): boolean {
    return left === right;
  },

  /**
   * @param value - Canonical workspace path.
   * @returns The final path segment for display.
   */
  displayName(value: WorkspacePath): string {
    if (value === "/" || windowsDriveRootPattern.test(value)) {
      return value;
    }

    const parts = value.split("/");
    const displayName = parts[parts.length - 1];

    return displayName === undefined || displayName.length === 0
      ? value
      : displayName;
  },
} as const;

/**
 * @param value - Trimmed raw path or file URL.
 * @returns A decoded filesystem path or an invalid file URL result.
 */
function parseFileUrl(value: string): FileUrlParseResult {
  if (!value.startsWith(fileUrlPrefix)) {
    return { ok: true, path: value };
  }

  try {
    const url = new URL(value);
    const pathname = decodeURIComponent(url.pathname);
    const withoutWindowsLeadingSlash = windowsFileUrlPathPattern.test(pathname)
      ? pathname.slice(1)
      : pathname;
    const path =
      url.host.length === 0
        ? withoutWindowsLeadingSlash
        : `//${url.host}${withoutWindowsLeadingSlash}`;

    return { ok: true, path };
  } catch {
    return { ok: false };
  }
}

/**
 * @param value - Decoded filesystem path.
 * @returns A separator-normalized path that preserves filesystem roots.
 */
function normalizePath(value: string): string {
  const forwardSlashPath = value.replace(/\\/g, "/");
  const isUncPath =
    forwardSlashPath.startsWith("//") && /[^/]/.test(forwardSlashPath.slice(2));
  const collapsedPath = forwardSlashPath.replace(/\/+/g, "/");
  const canonicalSeparators = isUncPath ? `/${collapsedPath}` : collapsedPath;

  if (
    canonicalSeparators === "/" ||
    windowsDriveRootPattern.test(canonicalSeparators)
  ) {
    return canonicalSeparators;
  }

  return canonicalSeparators.replace(/\/+$/u, "");
}
