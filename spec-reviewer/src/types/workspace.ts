export type WorkspaceKind = "plugin-workspace" | "spec-skill";

export type WorkspaceFileMapping = Readonly<{
  key: string;
  label: string;
  fileName: string;
}>;

export type Workspace = Readonly<{
  root: string;
  kind: WorkspaceKind;
  files: readonly WorkspaceFileMapping[];
}>;

export type LoadWorkspaceRequest = Readonly<{
  selectedDirectory: string;
}>;

export type ValidateWorkspaceDirectoryRequest = Readonly<{
  path: string;
}>;

export type ValidateWorkspaceDirectoryResponse = Readonly<{
  isDirectory: boolean;
}>;
