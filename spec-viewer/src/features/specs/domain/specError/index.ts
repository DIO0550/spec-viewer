import type { ArchiveSpecCommandError } from "@/shared/api/tauri/archiveSpec";
import type { ListSpecsCommandError } from "@/shared/api/tauri/listSpecs";
import type { ReadSpecFileCommandError } from "@/shared/api/tauri/readSpecFile";

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
  feature: "specs";
  code: SpecFeatureErrorCode;
  message: string;
  cause: SpecCommandError;
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
