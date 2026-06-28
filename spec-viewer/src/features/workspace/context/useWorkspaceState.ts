import { useCallback, useMemo, useRef, useState } from "react";

import { selectWorkspace } from "@/features/workspace/context/selectors";
import type {
  LoadWorkspaceOptions,
  WorkspaceActions,
  WorkspaceContextValue,
  WorkspaceState,
} from "@/features/workspace/context/types";
import { toWorkspaceError } from "@/features/workspace/domain/workspaceError";
import {
  loadWorkspace as defaultLoadWorkspace,
  toIpcCommandError,
} from "@/shared/api/tauri";
import { createGeneration, type Generation } from "@/domains/generation";

const initialWorkspaceState: WorkspaceState = {
  status: "idle",
};

/** @returns Workspace loading state and actions for selecting/resetting a workspace. */
export function useWorkspaceState(): WorkspaceContextValue {
  const generationRef = useRef<Generation>(createGeneration());
  const stateRef = useRef<WorkspaceState>(initialWorkspaceState);
  const [state, setState] = useState<WorkspaceState>(initialWorkspaceState);
  const generation = generationRef.current;

  const updateState = useCallback((nextState: WorkspaceState): void => {
    stateRef.current = nextState;
    setState(nextState);
  }, []);

  const load = useCallback(
    async (
      selectedDirectory: string,
      loadOptions: LoadWorkspaceOptions = {},
    ): Promise<boolean> => {
      const token = generation.next();
      const preservedWorkspace =
        loadOptions.preserveCurrentWorkspace === true
          ? selectWorkspace(stateRef.current)
          : null;

      updateState({
        status: "opening",
        requestedPath: selectedDirectory,
        currentWorkspace: preservedWorkspace,
        error: null,
      });

      try {
        const workspace = await defaultLoadWorkspace(selectedDirectory);

        if (!generation.isCurrent(token)) {
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
        if (!generation.isCurrent(token)) {
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
    [generation, updateState],
  );

  const reset = useCallback((): void => {
    generation.invalidate();
    updateState(initialWorkspaceState);
  }, [generation, updateState]);

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
