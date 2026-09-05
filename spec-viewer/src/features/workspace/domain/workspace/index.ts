export type WorkspaceKind =
  | "plugin-workspace"
  | "plugin-worktree"
  | "spec-skill";
export type WorkspaceConfigSource =
  | "default"
  | "workspaceConfig"
  | "specOverride";

export type WorkspaceFileMapping = Readonly<{
  key: string;
  label: string;
  fileName: string;
  configSource?: WorkspaceConfigSource;
}>;

export type Workspace = Readonly<{
  root: string;
  kind: WorkspaceKind;
  files: readonly WorkspaceFileMapping[];
}>;

export type WorkspaceParseError = Readonly<{
  reason: "invalidWorkspaceDto";
  field: string;
  message: string;
}>;

export type WorkspaceParseResult =
  | Readonly<{ ok: true; workspace: Workspace }>
  | Readonly<{ ok: false; error: WorkspaceParseError }>;

type WorkspaceFileMappingParseResult =
  | Readonly<{ ok: true; file: WorkspaceFileMapping }>
  | Readonly<{ ok: false; error: WorkspaceParseError }>;

export const Workspace = {
  /**
   * @param dto - Untrusted workspace DTO received from an external boundary.
   * @returns A validated workspace aggregate or a field-specific parse error.
   */
  fromDto(dto: unknown): WorkspaceParseResult {
    if (!isRecord(dto)) {
      return invalidWorkspaceDto("workspace", "Workspace must be an object");
    }

    if (!isNonEmptyString(dto.root)) {
      return invalidWorkspaceDto("root", "Workspace root must not be empty");
    }

    if (!isWorkspaceKind(dto.kind)) {
      return invalidWorkspaceDto("kind", "Workspace kind is not supported");
    }

    if (!Array.isArray(dto.files)) {
      return invalidWorkspaceDto("files", "Workspace files must be an array");
    }

    const files: WorkspaceFileMapping[] = [];
    for (const [index, fileDto] of dto.files.entries()) {
      const parsedFile = parseWorkspaceFileMapping(fileDto, index);

      if (!parsedFile.ok) {
        return parsedFile;
      }

      files.push(parsedFile.file);
    }

    return {
      ok: true,
      workspace: {
        root: dto.root,
        kind: dto.kind,
        files,
      },
    };
  },
} as const;

/** @returns A validated copy of a workspace file mapping DTO. */
function parseWorkspaceFileMapping(
  dto: unknown,
  index: number,
): WorkspaceFileMappingParseResult {
  const fieldPrefix = `files[${index}]`;

  if (!isRecord(dto)) {
    return invalidWorkspaceDto(fieldPrefix, "Workspace file must be an object");
  }

  if (!isNonEmptyString(dto.key)) {
    return invalidWorkspaceDto(
      `${fieldPrefix}.key`,
      "Workspace file key must not be empty",
    );
  }

  if (!isNonEmptyString(dto.label)) {
    return invalidWorkspaceDto(
      `${fieldPrefix}.label`,
      "Workspace file label must not be empty",
    );
  }

  if (!isNonEmptyString(dto.fileName)) {
    return invalidWorkspaceDto(
      `${fieldPrefix}.fileName`,
      "Workspace file name must not be empty",
    );
  }

  if (
    dto.configSource !== undefined &&
    !isWorkspaceConfigSource(dto.configSource)
  ) {
    return invalidWorkspaceDto(
      `${fieldPrefix}.configSource`,
      "Workspace config source is not supported",
    );
  }

  const file = {
    key: dto.key,
    label: dto.label,
    fileName: dto.fileName,
  };

  if (dto.configSource === undefined) {
    return { ok: true, file };
  }

  return {
    ok: true,
    file: { ...file, configSource: dto.configSource },
  };
}

/** @returns A field-specific workspace DTO parse failure. */
function invalidWorkspaceDto(
  field: string,
  message: string,
): Readonly<{ ok: false; error: WorkspaceParseError }> {
  return {
    ok: false,
    error: {
      reason: "invalidWorkspaceDto",
      field,
      message,
    },
  };
}

/** @returns True when a value is a non-empty string. */
function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/** @returns True when a value is a supported workspace kind. */
function isWorkspaceKind(value: unknown): value is WorkspaceKind {
  return (
    value === "plugin-workspace" ||
    value === "plugin-worktree" ||
    value === "spec-skill"
  );
}

/** @returns True when a value is a supported workspace config source. */
function isWorkspaceConfigSource(
  value: unknown,
): value is WorkspaceConfigSource {
  return (
    value === "default" ||
    value === "workspaceConfig" ||
    value === "specOverride"
  );
}

/** @returns True when a value is a non-null record. */
function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
