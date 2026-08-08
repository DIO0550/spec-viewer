import type {
  FileChangeStatus,
  FileDiff,
} from "@/features/diff/domain/fileDiff";

import {
  decodeFileReview,
  decodeGitObjectId,
  decodeLiteral,
  decodeNullableString,
  decodeRecord,
  decodeString,
  FILE_CHANGE_STATUSES,
  invalid,
} from "./diffPayloadDecoder";

export type ChangedSpecFile = Readonly<{
  specId: string;
  fileKey: string;
  targetPath: string;
  oldPath: string | null;
  newPath: string | null;
  change: FileChangeStatus;
}>;

export type ChangedSpecFiles = Readonly<{
  resolvedBaseSha: string;
  currentSnapshotId: string;
  files: readonly ChangedSpecFile[];
}>;

/**
 * @param value - Unknown list_changed_spec_files response.
 * @returns A validated readonly changed-file collection.
 * @throws InvalidDiffResponseError when the response violates the contract.
 */
export function decodeChangedSpecFiles(value: unknown): ChangedSpecFiles {
  const record = decodeRecord(value, "response", value);

  if (!Array.isArray(record.files)) {
    throw invalid("files", "an array", "received a non-array value", value);
  }

  return {
    resolvedBaseSha: decodeGitObjectId(
      record.resolvedBaseSha,
      "resolvedBaseSha",
      value,
    ),
    currentSnapshotId: decodeString(
      record.currentSnapshotId,
      "currentSnapshotId",
      value,
    ),
    files: record.files.map((candidate, index) => {
      const file = decodeRecord(candidate, `files[${index}]`, value);

      return {
        specId: decodeString(file.specId, `files[${index}].specId`, value),
        fileKey: decodeString(file.fileKey, `files[${index}].fileKey`, value),
        targetPath: decodeString(
          file.targetPath,
          `files[${index}].targetPath`,
          value,
        ),
        oldPath: decodeNullableString(
          file.oldPath,
          `files[${index}].oldPath`,
          value,
        ),
        newPath: decodeNullableString(
          file.newPath,
          `files[${index}].newPath`,
          value,
        ),
        change: decodeLiteral(
          file.change,
          `files[${index}].change`,
          value,
          FILE_CHANGE_STATUSES,
        ),
      };
    }),
  };
}

/**
 * @param value - Unknown get_spec_file_diff response.
 * @returns A validated readonly diff model.
 * @throws InvalidDiffResponseError when the response violates the contract.
 */
export function decodeSpecFileDiff(value: unknown): FileDiff {
  const record = decodeRecord(value, "response", value);

  return {
    specId: decodeString(record.specId, "specId", value),
    fileKey: decodeString(record.fileKey, "fileKey", value),
    review: decodeFileReview(record.review, "review", value),
  };
}
