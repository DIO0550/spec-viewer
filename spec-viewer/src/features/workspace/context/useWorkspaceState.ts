import { useCallback, useMemo, useRef, useState } from "react";

import { selectWorkspace } from "@/features/workspace/context/selectors";
import type {
  LoadWorkspaceOptions,
  UseWorkspaceStateOptions,
  WorkspaceActions,
  WorkspaceContextValue,
  WorkspaceState,
} from "@/features/workspace/context/types";
import { toWorkspaceError } from "@/features/workspace/domain/workspaceError";
import {
  loadWorkspace as defaultLoadWorkspace,
  toIpcCommandError,
} from "@/shared/api/tauri";

const initialWorkspaceState: WorkspaceState = {
  status: "idle",
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
          ? selectWorkspace(previousState)
          : null;

      updateState({
        status: "opening",
        requestedPath: selectedDirectory,
        currentWorkspace: preservedWorkspace,
        error: null,
      });

      try {
        const workspace = await loadWorkspace(selectedDirectory);

        if (requestIdRef.current !== requestId) {
          return false;
        }

        updateState({
          status: "opened",
          workspace,
          lastOpenError: null,
        });
        loadOptions.onWorkspaceLoaded?.(workspace);
        return true;
      } catch (error) {
        if (requestIdRef.current !== requestId) {
          return false;
        }

        const workspaceError = toWorkspaceError(toIpcCommandError(error));

        if (preservedWorkspace !== null) {
          updateState({
            status: "opened",
            workspace: preservedWorkspace,
            lastOpenError: workspaceError,
          });
          return false;
        }

        updateState({
          status: "failed",
          requestedPath: selectedDirectory,
          error: workspaceError,
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

  const actions: WorkspaceActions = useMemo(
    () => ({
      load,
      reset,
    }),
    [load, reset],
  );

  return {
    state,
    actions,
  };
}
