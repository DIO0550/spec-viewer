export type WorkspaceKind =
  | "plugin-workspace"
  | "plugin-worktree"
  | "spec-skill";
export type WorkspaceConfigSource =
  | "default"
  | "workspaceConfig"
  | "specOverride";

export type WorkspaceFileMapping = Readonly<{
  key: string;
  label: string;
  fileName: string;
  configSource?: WorkspaceConfigSource;
}>;

export type Workspace = Readonly<{
  root: string;
  kind: WorkspaceKind;
  files: readonly WorkspaceFileMapping[];
}>;

export const Workspace = {
  /** @returns A workspace aggregate restored from a validated boundary value. */
  create(input: Workspace): Workspace {
    return {
      ...input,
      files: input.files.map((file) => ({ ...file })),
    };
  },
} as const;
