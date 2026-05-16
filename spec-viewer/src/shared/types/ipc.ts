import type { CommentCommandPayloads } from "@/features/comments/types/comment";
import type { ReviewRunCommandPayloads } from "@/features/review-runs/types/reviewRun";
import type {
  ArchiveSpecRequest,
  ArchiveSpecResponse,
  ListSpecsRequest,
  ReadSpecFileRequest,
  SpecDocument,
  SpecTree,
} from "@/features/specs/types/spec";
import type {
  StartSpecFileWatchRequest,
  StartSpecFileWatchResponse,
  StopSpecFileWatchRequest,
  StopSpecFileWatchResponse,
} from "@/features/specs/types/watch";
import type {
  LoadWorkspaceRequest,
  ValidateWorkspaceDirectoryRequest,
  ValidateWorkspaceDirectoryResponse,
  Workspace,
} from "@/features/workspace/types/workspace";

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
  archive_spec: Readonly<{
    request: ArchiveSpecRequest;
    response: ArchiveSpecResponse;
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
