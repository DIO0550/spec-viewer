import { useCallback, useMemo, useReducer, useRef } from "react";

import {
  createGeneration,
  type Generation,
} from "@/features/workspace/application/generation";
import type { LoadWorkspace } from "@/features/workspace/application/ports/workspaceCommands";
import { WorkspaceState } from "@/features/workspace/application/workspaceState";
import type {
  LoadWorkspaceOptions,
  WorkspaceActions,
  WorkspaceContextValue,
} from "@/features/workspace/context/types";
import { toWorkspaceError } from "@/features/workspace/domain/workspaceError";
import { loadWorkspace as defaultLoadWorkspace } from "@/features/workspace/infra/tauri";
import { LoadWorkspaceCommandError } from "@/features/workspace/infra/tauri/loadWorkspace";

const loadWorkspace: LoadWorkspace = defaultLoadWorkspace;

/** @returns Workspace loading state and actions for selecting/resetting a workspace. */
export function useWorkspaceState(): WorkspaceContextValue {
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
        const workspaceError = toWorkspaceError(
          LoadWorkspaceCommandError.fromUnknown(error),
        );
        dispatch(
          WorkspaceState.openFailed({ requestId, error: workspaceError }),
        );
        return false;
      }
    },
    [generation],
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
