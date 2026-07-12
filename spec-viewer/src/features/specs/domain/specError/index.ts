import type { ArchiveSpecCommandError } from "@/features/specs/infra/tauri/archiveSpec";
import type { ListSpecsCommandError } from "@/features/specs/infra/tauri/listSpecs";
import type { ReadSpecFileCommandError } from "@/features/specs/infra/tauri/readSpecFile";

export type SpecCommandError =
  | ArchiveSpecCommandError
  | ListSpecsCommandError
  | ReadSpecFileCommandError;

export type SpecFeatureErrorCode =
  | "invalidSpec"
  | "specTreeScan"
  | "specArchive"
  | "markdownRead"
  | "invalidRequest"
  | "unknown";

export type SpecFeatureError = Readonly<{
  /** @deprecated Optional only while legacy fixtures migrate to feature-level errors. */
  feature?: "specs";
  code: SpecFeatureErrorCode | string;
  message: string;
  cause?: SpecCommandError;
  /** @deprecated Compatibility field for legacy normalized command error fixtures. */
  raw?: unknown;
}>;

export const SpecFeatureError = {
  /** @returns A feature-level spec error from a command error. */
  fromCommandError(error: SpecCommandError): SpecFeatureError {
    return {
      feature: "specs",
      code: SpecFeatureError.fromCommandErrorCode(error.code),
      message: error.message,
      cause: error,
    };
  },

  /** @returns A feature error code mapped from a spec command code. */
  fromCommandErrorCode(code: SpecCommandError["code"]): SpecFeatureErrorCode {
    if (
      code === "invalidSpec" ||
      code === "specTreeScan" ||
      code === "specArchive" ||
      code === "markdownRead" ||
      code === "invalidRequest"
    ) {
      return code;
    }

    return "unknown";
  },
} as const;
