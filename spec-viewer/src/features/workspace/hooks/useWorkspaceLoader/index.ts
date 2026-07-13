import { useCallback, useEffect, useMemo, useState } from "react";

import {
  createOpenWorkspaceUseCase,
  isWorkspaceOpenGuarded,
  type OpenWorkspaceOutcome,
  type OpenWorkspacePorts,
} from "@/features/workspace/application/openWorkspace";
import { useWorkspace } from "@/features/workspace/context/hooks";
import {
  selectActiveWorkspaceRoot,
  selectIsWorkspaceOpening,
  selectWorkspace,
  selectWorkspaceError,
} from "@/features/workspace/context/selectors";
import {
  WorkspacePath,
  type WorkspacePath as WorkspacePathValue,
} from "@/features/workspace/domain/workspacePath";
import { useRecentWorkspaces } from "@/features/workspace/hooks/useRecentWorkspaces";
import { useWorkspaceDrop } from "@/features/workspace/hooks/useWorkspaceDrop";
import type {
  UseWorkspaceLoaderOptions,
  UseWorkspaceLoaderResult,
  WorkspaceLoaderCommands,
} from "@/features/workspace/hooks/useWorkspaceLoader/types";
import { presentOpenWorkspaceOutcome } from "@/features/workspace/presentation/openWorkspacePresenter";
import {
  selectWorkspaceDirectory as defaultSelectWorkspaceDirectory,
  validateWorkspaceDirectory as defaultValidateWorkspaceDirectory,
} from "@/shared/api/tauri";
import { getUnknownErrorMessage } from "@/shared/lib/errorMessage";

const defaultWorkspaceLoaderCommands: WorkspaceLoaderCommands = {
  selectWorkspaceDirectory: defaultSelectWorkspaceDirectory,
  validateWorkspaceDirectory: defaultValidateWorkspaceDirectory,
};

export type {
  UseWorkspaceLoaderOptions,
  UseWorkspaceLoaderResult,
  WorkspaceLoaderCommands,
} from "@/features/workspace/hooks/useWorkspaceLoader/types";

/**
 * @param options - Shared error sink, recent-workspaces ports, and optional test adapters.
 * @returns Workspace open/restore/drop state and command adapters.
 */
export function useWorkspaceLoader(
  options: UseWorkspaceLoaderOptions,
): UseWorkspaceLoaderResult {
  const workspaceFromContext = useWorkspace();
  const workspace = options.workspace ?? workspaceFromContext;
  const recentWorkspaces = useRecentWorkspaces({
    repository: options.recentWorkspacesRepository,
    clock: options.recentWorkspacesClock,
  });

  const currentWorkspace = selectWorkspace(workspace.state);
  const activeWorkspaceRoot = selectActiveWorkspaceRoot(workspace.state);
  const isWorkspaceOpening = selectIsWorkspaceOpening(workspace.state);
  const workspaceError = selectWorkspaceError(workspace.state);

  const [workspaceInput, setWorkspaceInput] = useState("");
  const [isBrowsingWorkspace, setIsBrowsingWorkspace] = useState(false);
  const [dropErrorMessage, setDropErrorMessage] = useState<string | null>(null);
  const [hasAttemptedStartupRestore, setHasAttemptedStartupRestore] =
    useState(false);

  const commands = options.commands ?? defaultWorkspaceLoaderCommands;
  const onError = options.onError;
  const recordWorkspace = recentWorkspaces.recordWorkspace;
  const removeWorkspace = recentWorkspaces.removeWorkspace;
  const workspaceLoad = workspace.actions.load;
  const workspaceReset = workspace.actions.reset;
  const validateWorkspaceDirectory = commands.validateWorkspaceDirectory;
  const selectWorkspaceDirectory = commands.selectWorkspaceDirectory;

  const applyOpenProgress = useCallback(
    (path: WorkspacePathValue): void => {
      onError(null);
      setDropErrorMessage(null);
      setWorkspaceInput(WorkspacePath.toString(path));
    },
    [onError],
  );

  const openWorkspacePorts: OpenWorkspacePorts = useMemo(
    () => ({
      validate: (path) => {
        applyOpenProgress(path);
        return validateWorkspaceDirectory(WorkspacePath.toString(path));
      },
      load: async (path, loadOptions) => {
        applyOpenProgress(path);
        const loadOutcome = await workspaceLoad(path, {
          preserveCurrentWorkspace: loadOptions.preserveCurrentWorkspace,
        });

        if (loadOutcome.type === "canceled") {
          return { type: "canceled" };
        }

        if (loadOutcome.type === "failed") {
          return { type: "unsupported" };
        }

        return { type: "loaded", workspace: loadOutcome.workspace };
      },
      recentWorkspaces: {
        record: async (loadedWorkspace) => {
          recordWorkspace(loadedWorkspace);
        },
        remove: async (path) => {
          removeWorkspace(path);
        },
      },
    }),
    [
      applyOpenProgress,
      recordWorkspace,
      removeWorkspace,
      validateWorkspaceDirectory,
      workspaceLoad,
    ],
  );
  const openWorkspace = useMemo(
    () => createOpenWorkspaceUseCase(openWorkspacePorts),
    [openWorkspacePorts],
  );

  const dispatchOpenWorkspaceOutcome = useCallback(
    (outcome: OpenWorkspaceOutcome): void => {
      const presentation = presentOpenWorkspaceOutcome(outcome);

      if (presentation.type === "none") {
        return;
      }

      if (presentation.type === "dropError") {
        setDropErrorMessage(presentation.message);
        return;
      }

      onError(presentation.message);
      setWorkspaceInput(presentation.rollbackInput);
    },
    [onError],
  );

  const availability = useMemo(
    () => ({ isWorkspaceOpening, isBrowsingWorkspace }),
    [isBrowsingWorkspace, isWorkspaceOpening],
  );

  /** Opens a native directory picker and dispatches the selected browse command. */
  const browseWorkspace = async (): Promise<void> => {
    if (isWorkspaceOpenGuarded(availability)) {
      return;
    }

    onError(null);
    setIsBrowsingWorkspace(true);

    try {
      const selectedDirectory = await selectWorkspaceDirectory();

      if (selectedDirectory === null) {
        return;
      }

      const outcome = await openWorkspace({
        type: "browse",
        rawPath: selectedDirectory,
      });
      dispatchOpenWorkspaceOutcome(outcome);
    } catch (error) {
      onError(getUnknownErrorMessage(error));
    } finally {
      setIsBrowsingWorkspace(false);
    }
  };

  /** Dispatches the current input as an open command. */
  const loadWorkspace = (): void => {
    void openWorkspace({ type: "input", rawPath: workspaceInput }).then(
      dispatchOpenWorkspaceOutcome,
    );
  };

  const openRecentWorkspacePath = useCallback(
    async (path: WorkspacePathValue): Promise<void> => {
      const outcome = await openWorkspace({
        type: "recent",
        path,
        activeWorkspaceRoot,
        availability,
      });
      dispatchOpenWorkspaceOutcome(outcome);
    },
    [
      activeWorkspaceRoot,
      availability,
      dispatchOpenWorkspaceOutcome,
      openWorkspace,
    ],
  );

  /** Resets the current workspace and view feedback state. */
  const resetWorkspace = (): void => {
    setWorkspaceInput("");
    onError(null);
    setDropErrorMessage(null);
    workspaceReset();
  };

  useEffect(() => {
    if (hasAttemptedStartupRestore) {
      return;
    }
    if (
      currentWorkspace !== null ||
      isWorkspaceOpening ||
      isBrowsingWorkspace
    ) {
      return;
    }
    if (recentWorkspaces.lastActiveWorkspacePath === null) {
      return;
    }

    setHasAttemptedStartupRestore(true);
    void openWorkspace({
      type: "startupRestore",
      path: recentWorkspaces.lastActiveWorkspacePath,
      activeWorkspaceRoot,
      availability,
    }).then(dispatchOpenWorkspaceOutcome);
  }, [
    activeWorkspaceRoot,
    availability,
    currentWorkspace,
    dispatchOpenWorkspaceOutcome,
    hasAttemptedStartupRestore,
    isBrowsingWorkspace,
    isWorkspaceOpening,
    openWorkspace,
    recentWorkspaces.lastActiveWorkspacePath,
  ]);

  const handleDropWorkspacePath = useCallback(
    (path: WorkspacePathValue): void => {
      void openWorkspace({ type: "drop", path, availability }).then(
        dispatchOpenWorkspaceOutcome,
      );
    },
    [availability, dispatchOpenWorkspaceOutcome, openWorkspace],
  );

  const workspaceDrop = useWorkspaceDrop({
    isDisabled: isWorkspaceOpening || isBrowsingWorkspace,
    onDropWorkspacePath: handleDropWorkspacePath,
    onInvalidDrop: setDropErrorMessage,
    subscribeDragDropEvents: options.subscribeDragDropEvents,
  });

  return {
    state: {
      activeWorkspaceRoot,
      isWorkspaceOpening,
      isBrowsingWorkspace,
      workspaceInput,
      dropErrorMessage,
      workspaceErrorMessage: workspaceError?.message ?? null,
      isDraggingWorkspace: workspaceDrop.status === "dragging",
    },
    actions: {
      setWorkspaceInput,
      browseWorkspace,
      loadWorkspace,
      openRecentWorkspacePath,
      resetWorkspace,
    },
    recentWorkspaces: {
      recentWorkspaces: recentWorkspaces.recentWorkspaces,
      removeWorkspace: recentWorkspaces.removeWorkspace,
    },
  };
}
