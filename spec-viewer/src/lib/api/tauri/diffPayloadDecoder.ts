import {
  type ContentClassification,
  type DiffLineSource,
  type EntryKind,
  type FileChange,
  type FileChangeStatus,
  type FileContent,
  type FileReview,
  Hunk,
  type OmissionReason,
  type StructuredDiff,
  type SubmoduleState,
} from "@/features/diff/domain/fileDiff";

import { isRecord } from "./isRecord";

/**
 * Raised when an IPC diff payload violates the transport contract shared by
 * the Spec-scoped and repository-scoped diff commands.
 */
export class InvalidDiffResponseError extends Error {
  readonly code = "invalidResponse" as const;
  readonly raw: unknown;

  /**
   * @param message - Stable path-and-constraint validation message.
   * @param raw - Complete raw IPC response.
   */
  constructor(message: string, raw: unknown) {
    super(message);
    this.name = "InvalidDiffResponseError";
    this.raw = raw;
  }
}

/**
 * Creates a stable response-validation error that preserves the full raw payload.
 *
 * @param path - Validation path of the offending value.
 * @param constraint - The constraint the value failed to satisfy.
 * @param reason - Why the value was rejected.
 * @param raw - Complete raw IPC response.
 * @returns An error carrying the message and the raw payload.
 */
export const invalid = (
  path: string,
  constraint: string,
  reason: string,
  raw: unknown,
): InvalidDiffResponseError =>
  new InvalidDiffResponseError(`${path} must be ${constraint}: ${reason}`, raw);

/**
 * Decodes an unknown value as a record at the specified validation path.
 *
 * @param value - Candidate value to validate.
 * @param path - Validation path used in the error message.
 * @param raw - Complete raw response, attached to the thrown error for debugging.
 * @returns The value, unchanged, when it is a record.
 * @throws InvalidDiffResponseError when the value is not a record.
 */
export const decodeRecord = (
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
 * Decodes an unknown value as a string at the specified validation path.
 *
 * @param value - Candidate value to validate.
 * @param path - Validation path used in the error message.
 * @param raw - Complete raw response, attached to the thrown error for debugging.
 * @returns The value, unchanged, when it is a string.
 * @throws InvalidDiffResponseError when the value is not a string.
 */
export const decodeString = (
  value: unknown,
  path: string,
  raw: unknown,
): string => {
  if (typeof value !== "string") {
    throw invalid(path, "a string", "received a non-string value", raw);
  }

  return value;
};

/**
 * Decodes a Git object ID in SHA-1 or SHA-256 form.
 *
 * @param value - Candidate value to validate.
 * @param path - Validation path used in the error message.
 * @param raw - Complete raw response, attached to the thrown error for debugging.
 * @returns The lowercase hexadecimal object ID.
 * @throws InvalidDiffResponseError when the value is not a valid Git object ID.
 */
export const decodeGitObjectId = (
  value: unknown,
  path: string,
  raw: unknown,
): string => {
  const objectId = decodeString(value, path, raw);
  const hasValidLength = objectId.length === 40 || objectId.length === 64;
  const isLowercaseHex = !/[^0-9a-f]/.test(objectId);
  if (!hasValidLength || !isLowercaseHex) {
    throw invalid(
      path,
      "a lowercase 40 or 64 character Git object ID",
      "received an invalid value",
      raw,
    );
  }
  return objectId;
};

/**
 * Decodes an unknown value as a nullable string.
 *
 * @param value - Candidate value to validate.
 * @param path - Validation path used in the error message.
 * @param raw - Complete raw response, attached to the thrown error for debugging.
 * @returns Null, or the value when it is a string.
 * @throws InvalidDiffResponseError when the value is neither null nor a string.
 */
export const decodeNullableString = (
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
 * Decodes an unknown value as a nullable safe non-negative integer.
 *
 * @param value - Candidate value to validate.
 * @param path - Validation path used in the error message.
 * @param raw - Complete raw response, attached to the thrown error for debugging.
 * @returns Null, or the value when it is a safe non-negative integer.
 * @throws InvalidDiffResponseError when the value violates the constraint.
 */
export const decodeNullableSafeInteger = (
  value: unknown,
  path: string,
  raw: unknown,
): number | null => {
  if (value === null) {
    return null;
  }

  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw invalid(
      path,
      "null or a safe non-negative integer",
      `received ${String(value)}`,
      raw,
    );
  }

  return value;
};

/**
 * Decodes Git similarity as null or an integer from 0 through 100.
 *
 * @param value - Candidate value to validate.
 * @param path - Validation path used in the error message.
 * @param raw - Complete raw response, attached to the thrown error for debugging.
 * @returns Null, or the similarity percentage.
 * @throws InvalidDiffResponseError when the value is outside 0 through 100.
 */
export const decodeSimilarity = (
  value: unknown,
  path: string,
  raw: unknown,
): number | null => {
  const similarity = decodeNullableSafeInteger(value, path, raw);
  if (similarity !== null && similarity > 100) {
    throw invalid(
      path,
      "null or an integer from 0 through 100",
      `received ${similarity}`,
      raw,
    );
  }

  return similarity;
};

/**
 * Decodes an unknown value as a boolean.
 *
 * @param value - Candidate value to validate.
 * @param path - Validation path used in the error message.
 * @param raw - Complete raw response, attached to the thrown error for debugging.
 * @returns The value, unchanged, when it is a boolean.
 * @throws InvalidDiffResponseError when the value is not a boolean.
 */
export const decodeBoolean = (
  value: unknown,
  path: string,
  raw: unknown,
): boolean => {
  if (typeof value !== "boolean") {
    throw invalid(path, "a boolean", `received ${String(value)}`, raw);
  }

  return value;
};

/**
 * Validates an array of strings without copying it, so a large path list can
 * be shared with the raw response instead of doubling memory.
 *
 * @param value - Candidate value to validate.
 * @param path - Validation path used in the error message.
 * @param raw - Complete raw response, attached to the thrown error for debugging.
 * @returns The very same array instance, typed as readonly strings.
 * @throws InvalidDiffResponseError when the value is not an array of strings.
 */
export const decodeStringArrayInPlace = (
  value: unknown,
  path: string,
  raw: unknown,
): readonly string[] => {
  if (!Array.isArray(value)) {
    throw invalid(path, "an array", "received a non-array value", raw);
  }

  for (const [index, entry] of value.entries()) {
    decodeString(entry, `${path}[${index}]`, raw);
  }

  return value as readonly string[];
};

export const FILE_CHANGE_STATUSES = [
  "added",
  "modified",
  "deleted",
  "renamed",
  "copied",
  "typeChanged",
  "untracked",
] as const satisfies readonly FileChangeStatus[];
export const DIFF_LINE_KINDS = [
  "context",
  "added",
  "removed",
  "noNewline",
] as const;
export const ENTRY_KINDS = [
  "regular",
  "symlink",
  "submodule",
] as const satisfies readonly EntryKind[];
export const CONTENT_CLASSIFICATIONS = [
  "text",
  "binary",
  "notApplicable",
  "unknown",
] as const satisfies readonly ContentClassification[];
export const OMISSION_REASONS = [
  "binary",
  "largeFile",
  "diffLimit",
  "missingSide",
  "unsupportedEntryKind",
] as const satisfies readonly OmissionReason[];

/**
 * Decodes an unknown string against a closed literal set.
 *
 * @param value - Candidate value to validate.
 * @param path - Validation path used in the error message.
 * @param raw - Complete raw response, attached to the thrown error for debugging.
 * @param values - The closed set of accepted literals.
 * @returns The value, narrowed to the literal union.
 * @throws InvalidDiffResponseError when the value is outside the set.
 */
export const decodeLiteral = <const Values extends readonly string[]>(
  value: unknown,
  path: string,
  raw: unknown,
  values: Values,
): Values[number] => {
  if (typeof value !== "string" || !values.includes(value)) {
    throw invalid(
      path,
      `one of ${values.join("|")}`,
      `received ${JSON.stringify(value)}`,
      raw,
    );
  }

  return value as Values[number];
};

/**
 * Decodes an available or omitted content payload.
 *
 * @param value - Candidate value to validate.
 * @param path - Validation path used in the error message.
 * @param raw - Complete raw response, attached to the thrown error for debugging.
 * @returns The decoded content variant.
 * @throws InvalidDiffResponseError when the shape or state is invalid.
 */
export const decodeContent = (
  value: unknown,
  path: string,
  raw: unknown,
): FileContent => {
  const record = decodeRecord(value, path, raw);

  if (record.state === "available") {
    if (record.reason !== null || record.byteLength !== null) {
      throw invalid(
        path,
        "available content with null metadata",
        "shape is invalid",
        raw,
      );
    }

    return {
      state: "available",
      text: decodeString(record.text, `${path}.text`, raw),
      reason: null,
      byteLength: null,
    };
  }

  if (record.state === "omitted") {
    if (record.text !== null) {
      throw invalid(`${path}.text`, "null", "omitted content has text", raw);
    }

    return {
      state: "omitted",
      text: null,
      reason: decodeLiteral(
        record.reason,
        `${path}.reason`,
        raw,
        OMISSION_REASONS,
      ),
      byteLength: decodeNullableSafeInteger(
        record.byteLength,
        `${path}.byteLength`,
        raw,
      ),
    };
  }

  throw invalid(path, "available or omitted content", "state is invalid", raw);
};

/**
 * Decodes file metadata without normalizing Backend literal values.
 *
 * @param value - Candidate value to validate.
 * @param path - Validation path used in the error message.
 * @param raw - Complete raw response, attached to the thrown error for debugging.
 * @returns The decoded file change metadata.
 * @throws InvalidDiffResponseError when any field violates the contract.
 */
export const decodeFileChange = (
  value: unknown,
  path: string,
  raw: unknown,
): FileChange => {
  const record = decodeRecord(value, path, raw);

  return {
    oldPath: decodeNullableString(record.oldPath, `${path}.oldPath`, raw),
    newPath: decodeNullableString(record.newPath, `${path}.newPath`, raw),
    change: decodeLiteral(
      record.change,
      `${path}.change`,
      raw,
      FILE_CHANGE_STATUSES,
    ),
    entryKind: decodeLiteral(
      record.entryKind,
      `${path}.entryKind`,
      raw,
      ENTRY_KINDS,
    ),
    contentClassification: decodeLiteral(
      record.contentClassification,
      `${path}.contentClassification`,
      raw,
      CONTENT_CLASSIFICATIONS,
    ),
    similarity: decodeSimilarity(record.similarity, `${path}.similarity`, raw),
    oldMode: decodeNullableString(record.oldMode, `${path}.oldMode`, raw),
    newMode: decodeNullableString(record.newMode, `${path}.newMode`, raw),
  };
};

/**
 * Decodes one transport diff line before line-number derivation.
 *
 * @param value - Candidate value to validate.
 * @param path - Validation path used in the error message.
 * @param raw - Complete raw response, attached to the thrown error for debugging.
 * @returns The decoded transport line.
 * @throws InvalidDiffResponseError when the kind or text is invalid.
 */
const decodeDiffLine = (
  value: unknown,
  path: string,
  raw: unknown,
): DiffLineSource => {
  const record = decodeRecord(value, path, raw);

  return {
    kind: decodeLiteral(record.kind, `${path}.kind`, raw, DIFF_LINE_KINDS),
    text: decodeString(record.text, `${path}.text`, raw),
  };
};

/**
 * @param header - Decoded hunk header string.
 * @param lines - Decoded transport lines.
 * @param path - Validation path for the hunk.
 * @param raw - Complete raw response.
 * @returns A hunk with derived line numbers.
 * @throws InvalidDiffResponseError when the header grammar is invalid.
 */
const createHunk = (
  header: string,
  lines: readonly DiffLineSource[],
  path: string,
  raw: unknown,
): ReturnType<typeof Hunk.fromLines> => {
  try {
    return Hunk.fromLines(header, lines);
  } catch {
    throw invalid(
      `${path}.header`,
      "a hunk header matching the unified diff grammar",
      `received ${JSON.stringify(header)}`,
      raw,
    );
  }
};

/**
 * Decodes available hunks or an omitted structured diff.
 *
 * @param value - Candidate value to validate.
 * @param path - Validation path used in the error message.
 * @param raw - Complete raw response, attached to the thrown error for debugging.
 * @returns The decoded structured diff variant.
 * @throws InvalidDiffResponseError when the shape or hunk grammar is invalid.
 */
export const decodeStructuredDiff = (
  value: unknown,
  path: string,
  raw: unknown,
): StructuredDiff => {
  const record = decodeRecord(value, path, raw);

  if (!Array.isArray(record.hunks)) {
    throw invalid(
      `${path}.hunks`,
      "an array",
      "received a non-array value",
      raw,
    );
  }

  if (record.state === "omitted") {
    if (record.hunks.length !== 0) {
      throw invalid(
        `${path}.hunks`,
        "an empty array",
        "omitted diff has hunks",
        raw,
      );
    }

    return {
      state: "omitted",
      hunks: [],
      reason: decodeLiteral(
        record.reason,
        `${path}.reason`,
        raw,
        OMISSION_REASONS,
      ),
    };
  }

  if (record.state !== "available" || record.reason !== null) {
    throw invalid(
      path,
      "an available or omitted diff",
      "shape is invalid",
      raw,
    );
  }

  return {
    state: "available",
    hunks: record.hunks.map((candidate, index) => {
      const hunkPath = `${path}.hunks[${index}]`;
      const hunk = decodeRecord(candidate, hunkPath, raw);
      if (!Array.isArray(hunk.lines)) {
        throw invalid(
          `${hunkPath}.lines`,
          "an array",
          "received a non-array value",
          raw,
        );
      }

      return createHunk(
        decodeString(hunk.header, `${hunkPath}.header`, raw),
        hunk.lines.map((line, lineIndex) =>
          decodeDiffLine(line, `${hunkPath}.lines[${lineIndex}]`, raw),
        ),
        hunkPath,
        raw,
      );
    }),
    reason: null,
  };
};

/**
 * Decodes nullable submodule state and all boolean flags.
 *
 * @param value - Candidate value to validate.
 * @param path - Validation path used in the error message.
 * @param raw - Complete raw response, attached to the thrown error for debugging.
 * @returns Null, or the decoded submodule state.
 * @throws InvalidDiffResponseError when any field violates the contract.
 */
export const decodeSubmodule = (
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
      `${path}.baseGitlinkOid`,
      raw,
    ),
    indexGitlinkOid: decodeNullableString(
      record.indexGitlinkOid,
      `${path}.indexGitlinkOid`,
      raw,
    ),
    worktreeHeadOid: decodeNullableString(
      record.worktreeHeadOid,
      `${path}.worktreeHeadOid`,
      raw,
    ),
    commitChanged: decodeBoolean(
      record.commitChanged,
      `${path}.commitChanged`,
      raw,
    ),
    trackedChanges: decodeBoolean(
      record.trackedChanges,
      `${path}.trackedChanges`,
      raw,
    ),
    untrackedChanges: decodeBoolean(
      record.untrackedChanges,
      `${path}.untrackedChanges`,
      raw,
    ),
    uninitialized: decodeBoolean(
      record.uninitialized,
      `${path}.uninitialized`,
      raw,
    ),
  };
};

/**
 * Decodes the complete file review payload shared by every diff command.
 *
 * @param value - Candidate value to validate.
 * @param path - Validation path used in the error message.
 * @param raw - Complete raw response, attached to the thrown error for debugging.
 * @returns The decoded file review.
 * @throws InvalidDiffResponseError when the response violates the contract.
 */
export const decodeFileReview = (
  value: unknown,
  path: string,
  raw: unknown,
): FileReview => {
  const record = decodeRecord(value, path, raw);

  return {
    file: decodeFileChange(record.file, `${path}.file`, raw),
    oldContent: decodeContent(record.oldContent, `${path}.oldContent`, raw),
    newContent: decodeContent(record.newContent, `${path}.newContent`, raw),
    patch: decodeContent(record.patch, `${path}.patch`, raw),
    structuredDiff: decodeStructuredDiff(
      record.structuredDiff,
      `${path}.structuredDiff`,
      raw,
    ),
    submodule: decodeSubmodule(record.submodule, `${path}.submodule`, raw),
  };
};
