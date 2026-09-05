export { Workspace } from "@/features/workspace/domain/workspace";
export type {
  WorkspaceConfigSource,
  WorkspaceFileMapping,
  WorkspaceKind,
} from "@/features/workspace/domain/workspace";

export type LoadWorkspaceRequest = Readonly<{
  selectedDirectory: string;
}>;

export type ValidateWorkspaceDirectoryRequest = Readonly<{
  path: string;
}>;

export type ValidateWorkspaceDirectoryResponse = Readonly<{
  isDirectory: boolean;
}>;
