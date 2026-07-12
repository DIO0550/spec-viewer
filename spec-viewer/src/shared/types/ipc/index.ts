export type CommandErrorCode =
  | "invalidRequest"
  | "workspaceDetection"
  | "configLoad"
  | "specTreeScan"
  | "specArchive"
  | "markdownRead"
  | "invalidSpec"
  | "invalidComment"
  | "commentRepository"
  | "userReviewExport"
  | "fileWatch"
  | "unexpected";

export type CommandErrorDto = Readonly<{
  code: CommandErrorCode;
  message: string;
}>;

export type IpcCommandError = Readonly<{
  code: CommandErrorCode | "unknown";
  message: string;
  raw: unknown;
}>;
