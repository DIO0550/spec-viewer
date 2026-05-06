import type { CommentCommandPayloads } from "./comment";
import type { ReviewRunCommandPayloads } from "./reviewRun";
import type {
  ListSpecsRequest,
  ReadSpecFileRequest,
  SpecDocument,
  SpecTree,
} from "./spec";
import type {
  StartSpecFileWatchRequest,
  StartSpecFileWatchResponse,
  StopSpecFileWatchRequest,
  StopSpecFileWatchResponse,
} from "./watch";
import type {
  LoadWorkspaceRequest,
  ValidateWorkspaceDirectoryRequest,
  ValidateWorkspaceDirectoryResponse,
  Workspace,
} from "./workspace";

export type CommandErrorCode =
  | "invalidRequest"
  | "workspaceDetection"
  | "configLoad"
  | "specTreeScan"
  | "markdownRead"
  | "invalidSpec"
  | "invalidComment"
  | "commentRepository"
  | "reviewRunExport"
  | "fileWatch";

export type CommandError = Readonly<{
  code: CommandErrorCode;
  message: string;
}>;

export type NormalizedCommandError = Readonly<{
  code: CommandErrorCode | "unknown";
  message: string;
  raw: unknown;
}>;

type WorkspaceCommandPayloads = Readonly<{
  load_workspace: Readonly<{
    request: LoadWorkspaceRequest;
    response: Workspace;
  }>;
  validate_workspace_directory: Readonly<{
    request: ValidateWorkspaceDirectoryRequest;
    response: ValidateWorkspaceDirectoryResponse;
  }>;
  list_specs: Readonly<{
    request: ListSpecsRequest;
    response: SpecTree;
  }>;
  read_spec_file: Readonly<{
    request: ReadSpecFileRequest;
    response: SpecDocument;
  }>;
  start_spec_file_watch: Readonly<{
    request: StartSpecFileWatchRequest;
    response: StartSpecFileWatchResponse;
  }>;
  stop_spec_file_watch: Readonly<{
    request: StopSpecFileWatchRequest;
    response: StopSpecFileWatchResponse;
  }>;
}>;

export type CommandPayloads = WorkspaceCommandPayloads &
  CommentCommandPayloads &
  ReviewRunCommandPayloads;

export type CommandName = keyof CommandPayloads;

export type CommandRequest<Name extends CommandName> =
  CommandPayloads[Name]["request"];

export type CommandResponse<Name extends CommandName> =
  CommandPayloads[Name]["response"];
