import type { SpecDocument, SpecTree } from "./spec";
import type { LoadWorkspaceRequest, Workspace } from "./workspace";
import type { ListSpecsRequest, ReadSpecFileRequest } from "./spec";

export type CommandErrorCode =
  | "invalidRequest"
  | "workspaceDetection"
  | "configLoad"
  | "specTreeScan"
  | "markdownRead";

export type CommandError = Readonly<{
  code: CommandErrorCode;
  message: string;
}>;

export type NormalizedCommandError = Readonly<{
  code: CommandErrorCode | "unknown";
  message: string;
  raw: unknown;
}>;

export type CommandPayloads = Readonly<{
  load_workspace: Readonly<{
    request: LoadWorkspaceRequest;
    response: Workspace;
  }>;
  list_specs: Readonly<{
    request: ListSpecsRequest;
    response: SpecTree;
  }>;
  read_spec_file: Readonly<{
    request: ReadSpecFileRequest;
    response: SpecDocument;
  }>;
}>;

export type CommandName = keyof CommandPayloads;

export type CommandRequest<Name extends CommandName> =
  CommandPayloads[Name]["request"];

export type CommandResponse<Name extends CommandName> =
  CommandPayloads[Name]["response"];
