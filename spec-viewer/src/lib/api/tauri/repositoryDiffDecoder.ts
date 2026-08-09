import {
  Hunk,
  type ContentClassification,
  type DiffLineSource,
  type DiffLineKind,
  type FileChangeStatus,
  type FileContent,
  type OmissionReason,
  type StructuredDiff,
  type SubmoduleState,
} from "@/features/diff/domain/fileDiff";

import { isRecord } from "./isRecord";

import type {
  BaseResolution,
  BaseResolutionFailure,
  BaseResolutionSource,
  IgnoredPage,
  RepositoryDiffFile,
  RepositoryDiffOverview,
  RepositoryFileReview,
  RepositoryTreeChildren,
  RepositoryTreeNode,
} from "@/features/repositoryDiff/domain/repositoryDiff";

export type {
  BaseResolution,
  BaseResolutionFailure,
  BaseResolutionSource,
  IgnoredPage,
  RepositoryDiffFile,
  RepositoryDiffOverview,
  RepositoryFileReview,
  RepositoryTreeChildren,
  RepositoryTreeNode,
} from "@/features/repositoryDiff/domain/repositoryDiff";

export class InvalidRepositoryDiffResponseError extends Error {
  readonly code: "invalidResponse" | "invalidRevision";
  readonly raw: unknown;

  /**
   * @param message - Stable path-and-constraint validation message.
   * @param raw - Complete raw IPC response.
   * @param code - Validation classification for the caller.
   */
  constructor(
    message: string,
    raw: unknown,
    code: "invalidResponse" | "invalidRevision" = "invalidResponse",
  ) {
    super(message);
    this.code = code;
    this.name = "InvalidRepositoryDiffResponseError";
    this.raw = raw;
  }
}

export const RepositoryDiffInvalidResponseError =
  InvalidRepositoryDiffResponseError;
export type RepositoryDiffInvalidResponseError =
  InvalidRepositoryDiffResponseError;
const invalid = (
  path: string,
  constraint: string,
  reason: string,
  raw: unknown,
  code: "invalidResponse" | "invalidRevision" = "invalidResponse",
): InvalidRepositoryDiffResponseError =>
  new InvalidRepositoryDiffResponseError(
    path + " must be " + constraint + ": " + reason,
    raw,
    code,
  );

/**
 * @param value - Candidate value.
 * @param path - Validation path.
 * @param raw - Complete raw response.
 * @returns A record when the candidate is an object.
 * @throws InvalidRepositoryDiffResponseError for non-record values.
 */
const decodeRecord = (
  value: unknown,
  path: string,
  raw: unknown,
): Readonly<Record<string, unknown>> => {
  if (!isRecord(value)) {
    throw invalid(path, "an object", "received a non-object value", raw);
  }

  return value;
};

/**
 * @param value - Candidate value.
 * @param path - Validation path.
 * @param raw - Complete raw response.
 * @returns A string when the candidate is a string.
 * @throws InvalidRepositoryDiffResponseError for non-string values.
 */
const decodeString = (value: unknown, path: string, raw: unknown): string => {
  if (typeof value !== "string") {
    throw invalid(path, "a string", "received a non-string value", raw);
  }

  return value;
};

/**
 * @param value - Candidate value.
 * @param path - Validation path.
 * @param raw - Complete raw response.
 * @returns A nullable string.
 * @throws InvalidRepositoryDiffResponseError for non-string non-null values.
 */
const decodeNullableString = (
  value: unknown,
  path: string,
  raw: unknown,
): string | null => {
  if (value === null) {
    return null;
  }

  return decodeString(value, path, raw);
};

/**
 * @param value - Candidate value.
 * @param path - Validation path.
 * @param raw - Complete raw response.
 * @returns A boolean when the candidate is a boolean.
 * @throws InvalidRepositoryDiffResponseError for non-boolean values.
 */
const decodeBoolean = (value: unknown, path: string, raw: unknown): boolean => {
  if (typeof value !== "boolean") {
    throw invalid(path, "a boolean", "received " + String(value), raw);
  }

  return value;
};

/**
 * @param value - Candidate value.
 * @param path - Validation path.
 * @param raw - Complete raw response.
 * @returns A non-negative safe integer.
 * @throws InvalidRepositoryDiffResponseError for invalid numeric values.
 */
const decodeSafeInteger = (
  value: unknown,
  path: string,
  raw: unknown,
): number => {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw invalid(
      path,
      "a safe non-negative integer",
      "received " + String(value),
      raw,
    );
  }

  return value;
};

/**
 * @param value - Candidate nullable number.
 * @param path - Validation path.
 * @param raw - Complete raw response.
 * @returns A nullable non-negative safe integer.
 * @throws InvalidRepositoryDiffResponseError for invalid numeric values.
 */
const decodeNullableSafeInteger = (
  value: unknown,
  path: string,
  raw: unknown,
): number | null => {
  if (value === null) {
    return null;
  }

  return decodeSafeInteger(value, path, raw);
};

/**
 * @param value - Candidate literal.
 * @param path - Validation path.
 * @param raw - Complete raw response.
 * @param values - Allowed literal values.
 * @returns The candidate narrowed to the allowed literal union.
 * @throws InvalidRepositoryDiffResponseError for unsupported values.
 */
const decodeLiteral = <const Values extends readonly string[]>(
  value: unknown,
  path: string,
  raw: unknown,
  values: Values,
): Values[number] => {
  if (typeof value !== "string" || !values.includes(value)) {
    throw invalid(
      path,
      "one of " + values.join("|"),
      "received " + JSON.stringify(value),
      raw,
    );
  }

  return value as Values[number];
};

/**
 * @param value - Candidate nullable literal.
 * @param path - Validation path.
 * @param raw - Complete raw response.
 * @param values - Allowed literal values.
 * @returns The candidate narrowed to a nullable literal union.
 * @throws InvalidRepositoryDiffResponseError for unsupported values.
 */
const decodeNullableLiteral = <const Values extends readonly string[]>(
  value: unknown,
  path: string,
  raw: unknown,
  values: Values,
): Values[number] | null => {
  if (value === null) {
    return null;
  }

  return decodeLiteral(value, path, raw, values);
};

const FILE_CHANGE_STATUSES = [
  "added",
  "modified",
  "deleted",
  "renamed",
  "copied",
  "typeChanged",
  "untracked",
] as const satisfies readonly FileChangeStatus[];
const ENTRY_KINDS = ["regular", "symlink", "submodule"] as const;
const CONTENT_CLASSIFICATIONS = [
  "text",
  "binary",
  "notApplicable",
  "unknown",
] as const satisfies readonly ContentClassification[];
const DIFF_LINE_KINDS = [
  "context",
  "added",
  "removed",
  "noNewline",
] as const satisfies readonly DiffLineKind[];
const OMISSION_REASONS = [
  "binary",
  "largeFile",
  "diffLimit",
  "missingSide",
  "unsupportedEntryKind",
] as const satisfies readonly OmissionReason[];
const BASE_SOURCES = [
  "explicit",
  "ghMergeBase",
  "currentRemoteHead",
  "originHead",
  "otherRemoteHead",
  "main",
  "master",
] as const satisfies readonly BaseResolutionSource[];
const BASE_FAILURES = [
  "notFound",
  "ambiguousRemoteHead",
  "detachedHead",
  "shallowHistory",
  "unbornHead",
  "noCommonAncestor",
] as const satisfies readonly BaseResolutionFailure[];
const BASE_OVERRIDE_REASONS = ["missingRef", "invalidRef"] as const;

const decodeArray = (
  value: unknown,
  path: string,
  raw: unknown,
): readonly unknown[] => {
  if (!Array.isArray(value)) {
    throw invalid(path, "an array", "received a non-array value", raw);
  }

  return value;
};

const decodeGitObjectId = (
  value: unknown,
  path: string,
  raw: unknown,
): string => {
  const objectId = decodeString(value, path, raw);
  if (
    (objectId.length !== 40 && objectId.length !== 64) ||
    /[^0-9a-f]/.test(objectId)
  ) {
    throw invalid(
      path,
      "a lowercase 40 or 64 character Git object ID",
      "received an invalid value",
      raw,
    );
  }

  return objectId;
};

const decodePrefixedId = (
  value: unknown,
  path: string,
  prefix: string,
  raw: unknown,
): string => {
  const identifier = decodeString(value, path, raw);
  const suffix = identifier.slice(prefix.length);
  if (!identifier.startsWith(prefix) || !/^[0-9a-f]{64}$/.test(suffix)) {
    throw invalid(
      path,
      "a " + prefix + " identifier with 64 lowercase hexadecimal characters",
      "received an invalid value",
      raw,
    );
  }

  return identifier;
};

const decodeRepositoryId = (
  value: unknown,
  path: string,
  raw: unknown,
): string => decodePrefixedId(value, path, "rr1_", raw);

const decodeSnapshotId = (value: unknown, path: string, raw: unknown): string =>
  decodePrefixedId(value, path, "rs1_", raw);

const decodeNodeId = (value: unknown, path: string, raw: unknown): string =>
  decodePrefixedId(value, path, "in1_", raw);

const decodeRepositoryPath = (
  value: unknown,
  path: string,
  raw: unknown,
): string => {
  const repositoryPath = decodeString(value, path, raw);
  const segments = repositoryPath.split("/");
  const hasControlCharacter = [...repositoryPath].some((character) => {
    const codePoint = character.charCodeAt(0);
    return codePoint < 0x20 || codePoint === 0x7f;
  });
  const hasInvalidSegment = segments.some(
    (segment) => segment.length === 0 || segment === "." || segment === "..",
  );
  if (
    repositoryPath.length === 0 ||
    repositoryPath.startsWith("/") ||
    repositoryPath.includes("\\") ||
    /^[A-Za-z]:/.test(repositoryPath) ||
    hasControlCharacter ||
    hasInvalidSegment
  ) {
    throw invalid(
      path,
      "a normalized repository-relative path",
      "received an invalid value",
      raw,
    );
  }

  return repositoryPath;
};

const decodeNullableRepositoryPath = (
  value: unknown,
  path: string,
  raw: unknown,
): string | null => {
  if (value === null) {
    return null;
  }

  return decodeRepositoryPath(value, path, raw);
};

const decodeBase = (
  value: unknown,
  path: string,
  raw: unknown,
): BaseResolution => {
  const record = decodeRecord(value, path, raw);
  const state = decodeLiteral(record.state, path + ".state", raw, [
    "resolved",
    "needsSelection",
    "invalidOverride",
  ] as const);
  const source = decodeNullableLiteral(
    record.source,
    path + ".source",
    raw,
    BASE_SOURCES,
  );
  const branchRef = decodeNullableString(
    record.branchRef,
    path + ".branchRef",
    raw,
  );
  const mergeBaseSha = decodeNullableString(
    record.mergeBaseSha,
    path + ".mergeBaseSha",
    raw,
  );
  const headSha = decodeNullableString(record.headSha, path + ".headSha", raw);
  const reason = decodeNullableString(record.reason, path + ".reason", raw);
  const candidates = decodeArray(
    record.candidates,
    path + ".candidates",
    raw,
  ).map((candidate, index) =>
    decodeString(candidate, path + ".candidates[" + index + "]", raw),
  );
  const overrideRef = decodeNullableString(
    record.overrideRef,
    path + ".overrideRef",
    raw,
  );

  if (state === "resolved") {
    if (
      source === null ||
      branchRef === null ||
      mergeBaseSha === null ||
      headSha === null ||
      reason !== null ||
      overrideRef !== null ||
      candidates.length !== 0
    ) {
      throw invalid(
        path,
        "a complete resolved base response",
        "shape is invalid",
        raw,
      );
    }

    return {
      state,
      source,
      branchRef,
      mergeBaseSha: decodeGitObjectId(
        mergeBaseSha,
        path + ".mergeBaseSha",
        raw,
      ),
      headSha: decodeGitObjectId(headSha, path + ".headSha", raw),
    };
  }

  if (state === "needsSelection") {
    if (
      source !== null ||
      branchRef !== null ||
      mergeBaseSha !== null ||
      headSha !== null ||
      reason === null ||
      overrideRef !== null
    ) {
      throw invalid(
        path,
        "a complete needsSelection base response",
        "shape is invalid",
        raw,
      );
    }

    return {
      state,
      reason: decodeLiteral(reason, path + ".reason", raw, BASE_FAILURES),
      candidates,
    };
  }

  if (
    source !== null ||
    branchRef !== null ||
    mergeBaseSha !== null ||
    headSha !== null ||
    reason === null ||
    overrideRef === null ||
    candidates.length !== 0
  ) {
    throw invalid(
      path,
      "a complete invalidOverride base response",
      "shape is invalid",
      raw,
    );
  }

  return {
    state,
    reason: decodeLiteral(reason, path + ".reason", raw, BASE_OVERRIDE_REASONS),
    overrideRef,
  };
};

const decodeFileChange = (
  value: unknown,
  path: string,
  raw: unknown,
): RepositoryDiffFile => {
  const record = decodeRecord(value, path, raw);
  const oldPath = decodeNullableRepositoryPath(
    record.oldPath,
    path + ".oldPath",
    raw,
  );
  const newPath = decodeNullableRepositoryPath(
    record.newPath,
    path + ".newPath",
    raw,
  );
  const change = decodeLiteral(
    record.change,
    path + ".change",
    raw,
    FILE_CHANGE_STATUSES,
  );
  const entryKind = decodeLiteral(
    record.entryKind,
    path + ".entryKind",
    raw,
    ENTRY_KINDS,
  );
  const contentClassification = decodeLiteral(
    record.contentClassification,
    path + ".contentClassification",
    raw,
    CONTENT_CLASSIFICATIONS,
  );
  const similarity = decodeNullableSafeInteger(
    record.similarity,
    path + ".similarity",
    raw,
  );
  const oldMode = decodeNullableString(record.oldMode, path + ".oldMode", raw);
  const newMode = decodeNullableString(record.newMode, path + ".newMode", raw);

  const hasValidSides =
    (change === "added" || change === "untracked") &&
    oldPath === null &&
    newPath !== null;
  const hasDeletedSides =
    change === "deleted" && oldPath !== null && newPath === null;
  const hasSameSides =
    (change === "modified" || change === "typeChanged") &&
    oldPath !== null &&
    oldPath === newPath;
  const hasRenamedSides =
    (change === "renamed" || change === "copied") &&
    oldPath !== null &&
    newPath !== null &&
    oldPath !== newPath;
  const sidesAreValid =
    hasValidSides || hasDeletedSides || hasSameSides || hasRenamedSides;
  const similarityIsValid =
    change === "renamed" || change === "copied"
      ? similarity !== null && similarity >= 50 && similarity <= 100
      : similarity === null;

  if (!sidesAreValid || !similarityIsValid) {
    throw invalid(
      path,
      "a diff file with valid oldPath/newPath/similarity invariants",
      "shape is invalid",
      raw,
    );
  }

  return {
    oldPath,
    newPath,
    change,
    entryKind,
    contentClassification,
    similarity,
    oldMode,
    newMode,
  };
};

const decodeContent = (
  value: unknown,
  path: string,
  raw: unknown,
): FileContent => {
  const record = decodeRecord(value, path, raw);
  const state = decodeLiteral(record.state, path + ".state", raw, [
    "available",
    "omitted",
  ] as const);

  if (state === "available") {
    if (record.reason !== null || record.byteLength !== null) {
      throw invalid(
        path,
        "available content with null metadata",
        "shape is invalid",
        raw,
      );
    }

    return {
      state,
      text: decodeString(record.text, path + ".text", raw),
      reason: null,
      byteLength: null,
    };
  }

  if (record.text !== null) {
    throw invalid(
      path,
      "omitted content with null text",
      "shape is invalid",
      raw,
    );
  }

  return {
    state,
    text: null,
    reason: decodeLiteral(
      record.reason,
      path + ".reason",
      raw,
      OMISSION_REASONS,
    ),
    byteLength: decodeNullableSafeInteger(
      record.byteLength,
      path + ".byteLength",
      raw,
    ),
  };
};

const decodeDiffLine = (
  value: unknown,
  path: string,
  raw: unknown,
): DiffLineSource => {
  const record = decodeRecord(value, path, raw);
  return {
    kind: decodeLiteral(record.kind, path + ".kind", raw, DIFF_LINE_KINDS),
    text: decodeString(record.text, path + ".text", raw),
  };
};

const decodeStructuredDiff = (
  value: unknown,
  path: string,
  raw: unknown,
): StructuredDiff => {
  const record = decodeRecord(value, path, raw);
  const state = decodeLiteral(record.state, path + ".state", raw, [
    "available",
    "omitted",
  ] as const);
  const hunks = decodeArray(record.hunks, path + ".hunks", raw);

  if (state === "omitted") {
    if (hunks.length !== 0) {
      throw invalid(path + ".hunks", "an empty array", "received hunks", raw);
    }

    return {
      state,
      hunks: [],
      reason: decodeLiteral(
        record.reason,
        path + ".reason",
        raw,
        OMISSION_REASONS,
      ),
    };
  }

  if (record.reason !== null) {
    throw invalid(
      path,
      "available structured diff with null reason",
      "shape is invalid",
      raw,
    );
  }

  return {
    state,
    reason: null,
    hunks: hunks.map((candidate, index) => {
      const hunkPath = path + ".hunks[" + index + "]";
      const hunk = decodeRecord(candidate, hunkPath, raw);
      const lines = decodeArray(hunk.lines, hunkPath + ".lines", raw);
      const header = decodeString(hunk.header, hunkPath + ".header", raw);
      try {
        return Hunk.fromLines(
          header,
          lines.map((line, lineIndex) =>
            decodeDiffLine(line, hunkPath + ".lines[" + lineIndex + "]", raw),
          ),
        );
      } catch {
        throw invalid(
          hunkPath + ".header",
          "a unified diff hunk header",
          "received " + JSON.stringify(header),
          raw,
        );
      }
    }),
  };
};

const decodeSubmodule = (
  value: unknown,
  path: string,
  raw: unknown,
): SubmoduleState | null => {
  if (value === null) {
    return null;
  }

  const record = decodeRecord(value, path, raw);
  return {
    baseGitlinkOid: decodeNullableString(
      record.baseGitlinkOid,
      path + ".baseGitlinkOid",
      raw,
    ),
    indexGitlinkOid: decodeNullableString(
      record.indexGitlinkOid,
      path + ".indexGitlinkOid",
      raw,
    ),
    worktreeHeadOid: decodeNullableString(
      record.worktreeHeadOid,
      path + ".worktreeHeadOid",
      raw,
    ),
    commitChanged: decodeBoolean(
      record.commitChanged,
      path + ".commitChanged",
      raw,
    ),
    trackedChanges: decodeBoolean(
      record.trackedChanges,
      path + ".trackedChanges",
      raw,
    ),
    untrackedChanges: decodeBoolean(
      record.untrackedChanges,
      path + ".untrackedChanges",
      raw,
    ),
    uninitialized: decodeBoolean(
      record.uninitialized,
      path + ".uninitialized",
      raw,
    ),
  };
};

const decodeReview = (
  value: unknown,
  path: string,
  raw: unknown,
): RepositoryFileReview => {
  const record = decodeRecord(value, path, raw);
  return {
    file: decodeFileChange(record.file, path + ".file", raw),
    oldContent: decodeContent(record.oldContent, path + ".oldContent", raw),
    newContent: decodeContent(record.newContent, path + ".newContent", raw),
    patch: decodeContent(record.patch, path + ".patch", raw),
    structuredDiff: decodeStructuredDiff(
      record.structuredDiff,
      path + ".structuredDiff",
      raw,
    ),
    submodule: decodeSubmodule(record.submodule, path + ".submodule", raw),
  };
};

const decodeTreeChildren = (
  value: unknown,
  path: string,
  raw: unknown,
): RepositoryTreeChildren => {
  const record = decodeRecord(value, path, raw);
  const state = decodeLiteral(record.state, path + ".state", raw, [
    "loaded",
    "deferred",
  ] as const);

  if (state === "deferred") {
    return {
      state,
      nodeId: decodeNodeId(record.nodeId, path + ".nodeId", raw),
    };
  }

  return {
    state,
    items: decodeArray(record.items, path + ".items", raw).map((item, index) =>
      decodeTreeNode(item, path + ".items[" + index + "]", raw),
    ),
  };
};

const decodeTreeNode = (
  value: unknown,
  path: string,
  raw: unknown,
): RepositoryTreeNode => {
  const record = decodeRecord(value, path, raw);
  return {
    path: decodeRepositoryPath(record.path, path + ".path", raw),
    name: decodeString(record.name, path + ".name", raw),
    kind: decodeLiteral(record.kind, path + ".kind", raw, [
      "file",
      "directory",
    ] as const),
    entryKind: decodeNullableLiteral(
      record.entryKind,
      path + ".entryKind",
      raw,
      ENTRY_KINDS,
    ),
    change: decodeNullableLiteral(
      record.change,
      path + ".change",
      raw,
      FILE_CHANGE_STATUSES,
    ),
    ignored: decodeBoolean(record.ignored, path + ".ignored", raw),
    children: decodeTreeChildren(record.children, path + ".children", raw),
  };
};

/**
 * @param value - Unknown load_repository_diff response.
 * @returns A validated repository-wide overview.
 * @throws InvalidRepositoryDiffResponseError for malformed response data.
 */
export function decodeRepositoryOverview(
  value: unknown,
): RepositoryDiffOverview {
  const record = decodeRecord(value, "response", value);
  const repositoryId =
    record.repositoryId === null
      ? null
      : decodeRepositoryId(record.repositoryId, "repositoryId", value);
  const currentSnapshotId =
    record.currentSnapshotId === null
      ? null
      : decodeSnapshotId(record.currentSnapshotId, "currentSnapshotId", value);
  const changed = decodeArray(record.changed, "changed", value).map(
    (file, index) => decodeFileChange(file, "changed[" + index + "]", value),
  );
  const changedTree = decodeArray(record.changedTree, "changedTree", value).map(
    (node, index) => decodeTreeNode(node, "changedTree[" + index + "]", value),
  );
  const allRoot = decodeArray(record.allRoot, "allRoot", value).map(
    (node, index) => decodeTreeNode(node, "allRoot[" + index + "]", value),
  );
  const allPaths = decodeArray(record.all, "all", value).map((path, index) =>
    decodeRepositoryPath(path, "all[" + index + "]", value),
  );
  const ignoredDirectories = decodeArray(
    record.ignoredDirectories,
    "ignoredDirectories",
    value,
  ).map((path, index) =>
    decodeRepositoryPath(path, "ignoredDirectories[" + index + "]", value),
  );
  const warnings = decodeArray(record.warnings, "warnings", value).map(
    (warning, index) => decodeString(warning, "warnings[" + index + "]", value),
  );

  return {
    repositoryId,
    base: decodeBase(record.base, "base", value),
    currentSnapshotId,
    changed,
    changedTree,
    allRoot,
    allPaths,
    ignoredDirectories,
    warnings,
  };
}

/**
 * @param value - Unknown traverse_repository_ignored response.
 * @returns A validated lazy ignored page.
 * @throws InvalidRepositoryDiffResponseError for malformed response data.
 */
export function decodeIgnoredPage(value: unknown): IgnoredPage {
  const record = decodeRecord(value, "response", value);
  return {
    nodeId: decodeNodeId(record.nodeId, "nodeId", value),
    entries: decodeArray(record.entries, "entries", value).map((entry, index) =>
      decodeTreeNode(entry, "entries[" + index + "]", value),
    ),
    nextCursor: decodeNullableString(record.nextCursor, "nextCursor", value),
  };
}

/**
 * @param value - Unknown load_repository_file response.
 * @returns A validated repository file review.
 * @throws InvalidRepositoryDiffResponseError for malformed response data.
 */
export function decodeRepositoryFileReview(
  value: unknown,
): RepositoryFileReview {
  return decodeReview(value, "response", value);
}

export type DiffAnchor = Readonly<{
  repositoryId: string;
  worktreeId: string;
  side: "base" | "current";
  oldPath: string | null;
  newPath: string | null;
  line: number;
  baseSha: string;
  currentSnapshotId: string;
  lineHash: string;
  snippet: string;
  context: string;
}>;

const MAX_U64_DECIMAL = "18446744073709551615";

/**
 * @param value - Candidate canonical decimal revision.
 * @param path - Validation path.
 * @param raw - Complete raw response.
 * @returns The unchanged canonical revision string.
 * @throws InvalidRepositoryDiffResponseError for non-canonical or overflowing values.
 */
export function decodeCanonicalRevision(
  value: unknown,
  path: string,
  raw: unknown,
): string {
  const revision = decodeString(value, path, raw);
  const isCanonical = revision === "0" || /^[1-9][0-9]*$/.test(revision);
  const exceedsU64 =
    revision.length > MAX_U64_DECIMAL.length ||
    (revision.length === MAX_U64_DECIMAL.length && revision > MAX_U64_DECIMAL);

  if (!isCanonical || exceedsU64) {
    throw invalid(
      path,
      "a canonical unsigned 64-bit decimal string",
      "received " + JSON.stringify(revision),
      raw,
      "invalidRevision",
    );
  }

  return revision;
}

/**
 * @param value - Unknown Diff anchor response.
 * @returns A validated Diff anchor with side/path invariants.
 * @throws InvalidRepositoryDiffResponseError for malformed anchors.
 */
export function decodeDiffAnchor(value: unknown): DiffAnchor {
  const record = decodeRecord(value, "anchor", value);
  const side = decodeLiteral(record.side, "anchor.side", value, [
    "base",
    "current",
  ] as const);
  const oldPath = decodeNullableRepositoryPath(
    record.oldPath,
    "anchor.oldPath",
    value,
  );
  const newPath = decodeNullableRepositoryPath(
    record.newPath,
    "anchor.newPath",
    value,
  );
  const line = decodeSafeInteger(record.line, "anchor.line", value);
  if (line < 1) {
    throw invalid(
      "anchor.line",
      "a positive line number",
      "received " + String(line),
      value,
    );
  }

  const hasRequiredSidePath =
    (side === "base" && oldPath !== null) ||
    (side === "current" && newPath !== null);
  if (!hasRequiredSidePath) {
    throw invalid(
      "anchor",
      "a side with its required oldPath/newPath",
      "shape is invalid",
      value,
    );
  }

  const worktreeId = decodeString(
    record.worktreeId,
    "anchor.worktreeId",
    value,
  );
  if (worktreeId.trim().length === 0) {
    throw invalid(
      "anchor.worktreeId",
      "a non-empty worktree ID",
      "received an empty value",
      value,
    );
  }

  return {
    repositoryId: decodeRepositoryId(
      record.repositoryId,
      "anchor.repositoryId",
      value,
    ),
    worktreeId,
    side,
    oldPath,
    newPath,
    line,
    baseSha: decodeGitObjectId(record.baseSha, "anchor.baseSha", value),
    currentSnapshotId: decodeSnapshotId(
      record.currentSnapshotId,
      "anchor.currentSnapshotId",
      value,
    ),
    lineHash: decodeString(record.lineHash, "anchor.lineHash", value),
    snippet: decodeString(record.snippet, "anchor.snippet", value),
    context: decodeString(record.context, "anchor.context", value),
  };
}
