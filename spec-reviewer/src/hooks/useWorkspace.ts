import { useCallback, useRef, useState } from "react";

import {
  loadWorkspace as defaultLoadWorkspace,
  normalizeCommandError,
} from "../lib/tauri";
import type { NormalizedCommandError } from "../types/ipc";
import type { Workspace } from "../types/workspace";

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
      workspace: null;
      error: null;
    }>
  | Readonly<{
      status: "ready";
      workspacePath: string;
      workspace: Workspace;
      error: null;
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

export type UseWorkspaceOptions = Readonly<{
  loadWorkspace?: LoadWorkspaceCommand;
}>;

export type UseWorkspaceResult = Readonly<{
  state: WorkspaceState;
  workspacePath: string | null;
  workspace: Workspace | null;
  isLoading: boolean;
  error: NormalizedCommandError | null;
  load: (selectedDirectory: string) => Promise<void>;
  reset: () => void;
}>;

const initialWorkspaceState: WorkspaceState = {
  status: "idle",
  workspacePath: null,
  workspace: null,
  error: null,
};

/** @returns Workspace loading state and actions for selecting/resetting a workspace. */
export function useWorkspace(
  options: UseWorkspaceOptions = {},
): UseWorkspaceResult {
  const loadWorkspace = options.loadWorkspace ?? defaultLoadWorkspace;
  const requestIdRef = useRef(0);
  const [state, setState] = useState<WorkspaceState>(initialWorkspaceState);

  const load = useCallback(
    async (selectedDirectory: string): Promise<void> => {
      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;

      setState({
        status: "loading",
        workspacePath: selectedDirectory,
        workspace: null,
        error: null,
      });

      try {
        const workspace = await loadWorkspace(selectedDirectory);

        if (requestIdRef.current !== requestId) {
          return;
        }

        setState({
          status: "ready",
          workspacePath: workspace.root,
          workspace,
          error: null,
        });
      } catch (error) {
        if (requestIdRef.current !== requestId) {
          return;
        }

        setState({
          status: "error",
          workspacePath: selectedDirectory,
          workspace: null,
          error: normalizeCommandError(error),
        });
      }
    },
    [loadWorkspace],
  );

  const reset = useCallback((): void => {
    requestIdRef.current += 1;
    setState(initialWorkspaceState);
  }, []);

  return {
    state,
    workspacePath: state.workspacePath,
    workspace: state.workspace,
    isLoading: state.status === "loading",
    error: state.error,
    load,
    reset,
  };
}
