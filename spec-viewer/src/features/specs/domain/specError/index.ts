// Preserve the existing cause contract while transport-independent errors are designed in #109.
export type SpecCommandError =
  | Readonly<{
      command: "archive_spec";
      code:
        | "invalidRequest"
        | "workspaceDetection"
        | "configLoad"
        | "specArchive"
        | "invalidSpec"
        | "unexpected"
        | "unknown";
      message: string;
      raw: unknown;
    }>
  | Readonly<{
      command: "list_specs";
      code:
        | "invalidRequest"
        | "workspaceDetection"
        | "configLoad"
        | "specTreeScan"
        | "unexpected"
        | "unknown";
      message: string;
      raw: unknown;
    }>
  | Readonly<{
      command: "load_spec_bundle";
      code:
        | "invalidRequest"
        | "workspaceDetection"
        | "configLoad"
        | "specTreeScan"
        | "markdownRead"
        | "invalidSpec"
        | "unexpected"
        | "unknown";
      message: string;
      raw: unknown;
    }>
  | Readonly<{
      command: "read_spec_file";
      code:
        | "invalidRequest"
        | "workspaceDetection"
        | "configLoad"
        | "markdownRead"
        | "invalidSpec"
        | "unexpected"
        | "unknown";
      message: string;
      raw: unknown;
    }>;

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
