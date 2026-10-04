/** Compatibility cause shape; semantic transport-error cleanup is tracked in #109. */
export type CommentCommandError =
  | Readonly<{
      command: "add_comment";
      code:
        | "invalidRequest"
        | "workspaceDetection"
        | "configLoad"
        | "invalidComment"
        | "commentRepository"
        | "unexpected"
        | "unknown";
      message: string;
      raw: unknown;
    }>
  | Readonly<{
      command: "delete_comment";
      code:
        | "invalidRequest"
        | "workspaceDetection"
        | "configLoad"
        | "markdownRead"
        | "invalidComment"
        | "commentRepository"
        | "unexpected"
        | "unknown";
      message: string;
      raw: unknown;
    }>
  | Readonly<{
      command: "export_comments";
      code:
        | "invalidRequest"
        | "workspaceDetection"
        | "configLoad"
        | "markdownRead"
        | "invalidComment"
        | "commentRepository"
        | "unexpected"
        | "unknown";
      message: string;
      raw: unknown;
    }>
  | Readonly<{
      command: "generate_llm_prompt";
      code:
        | "invalidRequest"
        | "workspaceDetection"
        | "configLoad"
        | "markdownRead"
        | "invalidComment"
        | "commentRepository"
        | "unexpected"
        | "unknown";
      message: string;
      raw: unknown;
    }>
  | Readonly<{
      command: "list_comments";
      code:
        | "invalidRequest"
        | "workspaceDetection"
        | "configLoad"
        | "markdownRead"
        | "invalidComment"
        | "commentRepository"
        | "unexpected"
        | "unknown";
      message: string;
      raw: unknown;
    }>
  | Readonly<{
      command: "reopen_comment";
      code:
        | "invalidRequest"
        | "workspaceDetection"
        | "configLoad"
        | "markdownRead"
        | "invalidComment"
        | "commentRepository"
        | "unexpected"
        | "unknown";
      message: string;
      raw: unknown;
    }>
  | Readonly<{
      command: "resolve_comment";
      code:
        | "invalidRequest"
        | "workspaceDetection"
        | "configLoad"
        | "markdownRead"
        | "invalidComment"
        | "commentRepository"
        | "unexpected"
        | "unknown";
      message: string;
      raw: unknown;
    }>
  | Readonly<{
      command: "update_comment";
      code:
        | "invalidRequest"
        | "workspaceDetection"
        | "configLoad"
        | "markdownRead"
        | "invalidComment"
        | "commentRepository"
        | "unexpected"
        | "unknown";
      message: string;
      raw: unknown;
    }>;

export type CommentFeatureErrorCode =
  | "invalidComment"
  | "commentRepository"
  | "invalidRequest"
  | "unknown";

export type CommentFeatureError = Readonly<{
  feature: "comments";
  code: CommentFeatureErrorCode;
  message: string;
  cause: CommentCommandError;
}>;

export const CommentFeatureError = {
  /** @returns A feature-level comment error from any comment command error. */
  fromCommandError(error: CommentCommandError): CommentFeatureError {
    return {
      feature: "comments",
      code: CommentFeatureError.fromCommandErrorCode(error.code),
      message: error.message,
      cause: error,
    };
  },

  /** @returns A comment feature error code mapped from a transport command code. */
  fromCommandErrorCode(
    code: CommentCommandError["code"],
  ): CommentFeatureErrorCode {
    if (
      code === "invalidComment" ||
      code === "commentRepository" ||
      code === "invalidRequest"
    ) {
      return code;
    }

    return "unknown";
  },
} as const;
