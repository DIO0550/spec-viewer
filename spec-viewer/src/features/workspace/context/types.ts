import type { ReactNode } from "react";

import type { Workspace } from "@/features/workspace/types/workspace";
import type { NormalizedCommandError } from "@/shared/types/ipc";

export type WorkspaceState =
  | Readonly<{
      status: "idle";
      workspacePath: null;
      workspace: null;
      error: null;
    }>
  | Readonly<{
      status: "loading";
      workspacePath: string;
      workspace: Workspace | null;
      error: null;
    }>
  | Readonly<{
      status: "ready";
      workspacePath: string;
      workspace: Workspace;
      error: NormalizedCommandError | null;
    }>
  | Readonly<{
      status: "error";
      workspacePath: string;
      workspace: null;
      error: NormalizedCommandError;
    }>;

export type LoadWorkspaceCommand = (
  selectedDirectory: string,
) => Promise<Workspace>;

export type UseWorkspaceStateOptions = Readonly<{
  loadWorkspace?: LoadWorkspaceCommand;
}>;

export type LoadWorkspaceOptions = Readonly<{
  preserveCurrentWorkspace?: boolean;
  onWorkspaceLoaded?: (workspace: Workspace) => void;
}>;

export type WorkspaceContextValue = Readonly<{
  state: WorkspaceState;
  workspacePath: string | null;
  workspace: Workspace | null;
  isLoading: boolean;
  error: NormalizedCommandError | null;
  load: (
    selectedDirectory: string,
    options?: LoadWorkspaceOptions,
  ) => Promise<boolean>;
  reset: () => void;
}>;

export type WorkspaceProviderProps = Readonly<{
  children: ReactNode;
}>;
