import { useCallback, useMemo, useReducer, useRef } from "react";

import {
  createGeneration,
  type Generation,
} from "@/features/workspace/application/generation";
import { WorkspaceState } from "@/features/workspace/application/workspaceState";
import type {
  LoadWorkspaceOptions,
  WorkspaceActions,
  WorkspaceContextValue,
} from "@/features/workspace/context/types";
import type { WorkspaceLoadCommands } from "../application/workspaceCommands";

/**
 * @param commands - Workspace loading and error-mapping operations from composition.
 * @returns Workspace loading state and actions for selecting/resetting a workspace.
 */
export function useWorkspaceState(
  commands: WorkspaceLoadCommands,
): WorkspaceContextValue {
  const { loadWorkspace, toWorkspaceError } = commands;
  const generationRef = useRef<Generation>(createGeneration());
  const [machine, dispatch] = useReducer(
    WorkspaceState.reduce,
    WorkspaceState.initial(),
  );
  const generation = generationRef.current;

  const load = useCallback(
    async (
      selectedDirectory: string,
      loadOptions: LoadWorkspaceOptions = {},
    ): Promise<boolean> => {
      const requestId = generation.next();
      dispatch(
        WorkspaceState.openRequested({
          requestId,
          requestedPath: selectedDirectory,
          preserveCurrentWorkspace:
            loadOptions.preserveCurrentWorkspace === true,
        }),
      );

      try {
        const workspace = await loadWorkspace(selectedDirectory);

        if (!generation.isCurrent(requestId)) {
          return false;
        }

        loadOptions.onWorkspaceLoaded?.(workspace);
        dispatch(WorkspaceState.openSucceeded({ requestId, workspace }));
        return true;
      } catch (error) {
        const workspaceError = toWorkspaceError(error);
        dispatch(
          WorkspaceState.openFailed({ requestId, error: workspaceError }),
        );
        return false;
      }
    },
    [generation, loadWorkspace, toWorkspaceError],
  );

  const reset = useCallback((): void => {
    generation.invalidate();
    dispatch(WorkspaceState.reset());
  }, [generation]);

  const actions: WorkspaceActions = useMemo(
    () => ({
      load,
      reset,
    }),
    [load, reset],
  );

  return {
    state: machine.state,
    actions,
  };
}
