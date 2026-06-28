import { useCallback, useRef, useState } from "react";

import type {
  LoadWorkspaceOptions,
  UseWorkspaceStateOptions,
  WorkspaceContextValue,
  WorkspaceState,
} from "@/features/workspace/context/types";
import {
  loadWorkspace as defaultLoadWorkspace,
  normalizeCommandError,
} from "@/shared/api/tauri";

const initialWorkspaceState: WorkspaceState = {
  status: "idle",
  workspacePath: null,
  workspace: null,
  error: null,
};

/** @returns Workspace loading state and actions for selecting/resetting a workspace. */
export function useWorkspaceState(
  options: UseWorkspaceStateOptions = {},
): WorkspaceContextValue {
  const loadWorkspace = options.loadWorkspace ?? defaultLoadWorkspace;
  const requestIdRef = useRef(0);
  const stateRef = useRef<WorkspaceState>(initialWorkspaceState);
  const [state, setState] = useState<WorkspaceState>(initialWorkspaceState);

  const updateState = useCallback((nextState: WorkspaceState): void => {
    stateRef.current = nextState;
    setState(nextState);
  }, []);

  const load = useCallback(
    async (
      selectedDirectory: string,
      loadOptions: LoadWorkspaceOptions = {},
    ): Promise<boolean> => {
      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;
      const previousState = stateRef.current;
      const preservedWorkspace =
        loadOptions.preserveCurrentWorkspace === true
          ? previousState.workspace
          : null;

      updateState({
        status: "loading",
        workspacePath: selectedDirectory,
        workspace: preservedWorkspace,
        error: null,
      });

      try {
        const workspace = await loadWorkspace(selectedDirectory);

        if (requestIdRef.current !== requestId) {
          return false;
        }

        updateState({
          status: "ready",
          workspacePath: workspace.root,
          workspace,
          error: null,
        });
        loadOptions.onWorkspaceLoaded?.(workspace);
        return true;
      } catch (error) {
        if (requestIdRef.current !== requestId) {
          return false;
        }

        const normalizedError = normalizeCommandError(error);

        if (preservedWorkspace !== null) {
          updateState({
            status: "ready",
            workspacePath: preservedWorkspace.root,
            workspace: preservedWorkspace,
            error: normalizedError,
          });
          return false;
        }

        updateState({
          status: "error",
          workspacePath: selectedDirectory,
          workspace: null,
          error: normalizedError,
        });
        return false;
      }
    },
    [loadWorkspace, updateState],
  );

  const reset = useCallback((): void => {
    requestIdRef.current += 1;
    updateState(initialWorkspaceState);
  }, [updateState]);

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
