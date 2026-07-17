import type {
  AddCommentCommandRequest,
  AddCommentCommandResponse,
} from "@/shared/api/tauri/addComment";
import type {
  ArchiveSpecCommandRequest,
  ArchiveSpecCommandResponse,
} from "@/shared/api/tauri/archiveSpec";
import type {
  DeleteCommentCommandRequest,
  DeleteCommentCommandResponse,
} from "@/shared/api/tauri/deleteComment";
import type {
  ExportCommentsCommandRequest,
  ExportCommentsCommandResponse,
} from "@/shared/api/tauri/exportComments";
import type {
  GenerateLlmPromptCommandRequest,
  GenerateLlmPromptCommandResponse,
} from "@/shared/api/tauri/generateLlmPrompt";
import type {
  ListCommentsCommandRequest,
  ListCommentsCommandResponse,
} from "@/shared/api/tauri/listComments";
import type {
  ListSpecsCommandRequest,
  ListSpecsCommandResponse,
} from "@/shared/api/tauri/listSpecs";
import type {
  LoadWorkspaceCommandRequest,
  LoadWorkspaceCommandResponse,
} from "@/shared/api/tauri/loadWorkspace";
import type {
  ReadSpecFileCommandRequest,
  ReadSpecFileCommandResponse,
} from "@/shared/api/tauri/readSpecFile";
import type {
  ReopenCommentCommandRequest,
  ReopenCommentCommandResponse,
} from "@/shared/api/tauri/reopenComment";
import type {
  ResolveCommentCommandRequest,
  ResolveCommentCommandResponse,
} from "@/shared/api/tauri/resolveComment";
import type {
  StartSpecFileWatchCommandRequest,
  StartSpecFileWatchCommandResponse,
} from "@/shared/api/tauri/startSpecFileWatch";
import type {
  StopSpecFileWatchCommandRequest,
  StopSpecFileWatchCommandResponse,
} from "@/shared/api/tauri/stopSpecFileWatch";
import type {
  ToggleCommentResolvedCommandRequest,
  ToggleCommentResolvedCommandResponse,
} from "@/shared/api/tauri/toggleCommentResolved";
import type {
  UpdateCommentCommandRequest,
  UpdateCommentCommandResponse,
} from "@/shared/api/tauri/updateComment";
import type {
  ValidateWorkspaceDirectoryCommandRequest,
  ValidateWorkspaceDirectoryCommandResponse,
} from "@/shared/api/tauri/validateWorkspaceDirectory";

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

/** @deprecated command contracts are owned by each shared/api/tauri/<command>.ts file. */
export type CommandPayloads = Readonly<{
  load_workspace: Readonly<{
    request: LoadWorkspaceCommandRequest;
    response: LoadWorkspaceCommandResponse;
  }>;
  validate_workspace_directory: Readonly<{
    request: ValidateWorkspaceDirectoryCommandRequest;
    response: ValidateWorkspaceDirectoryCommandResponse;
  }>;
  list_specs: Readonly<{
    request: ListSpecsCommandRequest;
    response: ListSpecsCommandResponse;
  }>;
  read_spec_file: Readonly<{
    request: ReadSpecFileCommandRequest;
    response: ReadSpecFileCommandResponse;
  }>;
  archive_spec: Readonly<{
    request: ArchiveSpecCommandRequest;
    response: ArchiveSpecCommandResponse;
  }>;
  start_spec_file_watch: Readonly<{
    request: StartSpecFileWatchCommandRequest;
    response: StartSpecFileWatchCommandResponse;
  }>;
  stop_spec_file_watch: Readonly<{
    request: StopSpecFileWatchCommandRequest;
    response: StopSpecFileWatchCommandResponse;
  }>;
  list_comments: Readonly<{
    request: ListCommentsCommandRequest;
    response: ListCommentsCommandResponse;
  }>;
  add_comment: Readonly<{
    request: AddCommentCommandRequest;
    response: AddCommentCommandResponse;
  }>;
  update_comment: Readonly<{
    request: UpdateCommentCommandRequest;
    response: UpdateCommentCommandResponse;
  }>;
  delete_comment: Readonly<{
    request: DeleteCommentCommandRequest;
    response: DeleteCommentCommandResponse;
  }>;
  resolve_comment: Readonly<{
    request: ResolveCommentCommandRequest;
    response: ResolveCommentCommandResponse;
  }>;
  reopen_comment: Readonly<{
    request: ReopenCommentCommandRequest;
    response: ReopenCommentCommandResponse;
  }>;
  toggle_comment_resolved: Readonly<{
    request: ToggleCommentResolvedCommandRequest;
    response: ToggleCommentResolvedCommandResponse;
  }>;
  export_comments: Readonly<{
    request: ExportCommentsCommandRequest;
    response: ExportCommentsCommandResponse;
  }>;
  generate_llm_prompt: Readonly<{
    request: GenerateLlmPromptCommandRequest;
    response: GenerateLlmPromptCommandResponse;
  }>;
}>;

/** @deprecated new code should use each command file's *CommandName type. */
export type CommandName = keyof CommandPayloads;

/** @deprecated new code should use each command file's *CommandRequest type. */
export type CommandRequest<Name extends CommandName> =
  CommandPayloads[Name]["request"];

/** @deprecated new code should use each command file's *CommandResponse type. */
export type CommandResponse<Name extends CommandName> =
  CommandPayloads[Name]["response"];
