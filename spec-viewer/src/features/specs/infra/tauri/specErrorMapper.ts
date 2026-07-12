import type {
  SpecFeatureError,
  SpecFeatureErrorCode,
} from "@/features/specs/application/specError";
import type { SpecErrorReason } from "@/features/specs/domain/specError";
import {
  ArchiveSpecCommandError,
  type ArchiveSpecCommandError as ArchiveSpecCommandErrorType,
} from "@/features/specs/infra/tauri/archiveSpec";
import {
  ListSpecsCommandError,
  type ListSpecsCommandError as ListSpecsCommandErrorType,
} from "@/features/specs/infra/tauri/listSpecs";
import {
  ReadSpecFileCommandError,
  type ReadSpecFileCommandError as ReadSpecFileCommandErrorType,
} from "@/features/specs/infra/tauri/readSpecFile";

export type SpecErrorOperation = "archive" | "list" | "read";

type SpecCommandError =
  | ArchiveSpecCommandErrorType
  | ListSpecsCommandErrorType
  | ReadSpecFileCommandErrorType;

/**
 * @param operation - Spec command that rejected.
 * @param error - Unknown value rejected by the command boundary.
 * @returns Application error with a pure domain reason and stable display contract.
 */
export function toSpecFeatureError(
  operation: SpecErrorOperation,
  error: unknown,
): SpecFeatureError {
  const cause = toSpecCommandError(operation, error);
  const mapping = toSpecErrorMapping(cause.code);

  return {
    feature: "specs",
    code: mapping.code,
    message: cause.message,
    domainError: { reason: mapping.reason },
    cause,
  };
}

/**
 * @param operation - Spec command that rejected.
 * @param error - Unknown value rejected by the command boundary.
 * @returns The command-specific infrastructure error for a rejected operation.
 */
function toSpecCommandError(
  operation: SpecErrorOperation,
  error: unknown,
): SpecCommandError {
  switch (operation) {
    case "archive":
      return ArchiveSpecCommandError.fromUnknown(error);
    case "list":
      return ListSpecsCommandError.fromUnknown(error);
    case "read":
      return ReadSpecFileCommandError.fromUnknown(error);
  }
}

/**
 * @param code - Parsed spec command error code.
 * @returns Domain reason and display code for a spec command error code.
 */
function toSpecErrorMapping(
  code: SpecCommandError["code"],
): Readonly<{ code: SpecFeatureErrorCode; reason: SpecErrorReason }> {
  switch (code) {
    case "invalidSpec":
      return { code, reason: "specRejected" };
    case "specTreeScan":
      return { code, reason: "treeReadFailed" };
    case "specArchive":
      return { code, reason: "archiveFailed" };
    case "markdownRead":
      return { code, reason: "documentReadFailed" };
    case "invalidRequest":
      return { code, reason: "requestRejected" };
    default:
      return { code: "unknown", reason: "unexpectedFailure" };
  }
}
