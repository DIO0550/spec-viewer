import { useCallback, useEffect, useRef, useState } from "react";

import type { UseRecentWorkspacesResult } from "@/features/workspace/hooks/useRecentWorkspaces";
import type { UseWorkspaceResult } from "@/features/workspace/hooks/useWorkspace";
import { useWorkspaceDrop } from "@/features/workspace/hooks/useWorkspaceDrop";
import {
  normalizeCommandError,
  selectWorkspaceDirectory,
  validateWorkspaceDirectory,
} from "@/shared/api/tauri";

const invalidDroppedDirectoryMessage =
  "ワークスペースフォルダをドロップしてください。ファイルはワークスペースとして開けません。";
const missingSavedWorkspaceMessage =
  "ワークスペースが見つかりません。保存済み一覧から削除しました。";
const unsupportedSavedWorkspaceMessage =
  "対応していないワークスペースです。保存済み一覧から削除しました。";

type LoadWorkspacePathOptions = Readonly<{
  preserveCurrentWorkspace?: boolean;
}>;

type UseWorkspaceSessionOptions = Readonly<{
  workspace: UseWorkspaceResult;
  recentWorkspaces: UseRecentWorkspacesResult;
}>;

type UseWorkspaceSessionResult = Readonly<{
  workspaceInput: string;
  isBrowsing: boolean;
  toolbarErrorMessage: string | null;
  isDropTargetActive: boolean;
  /** @param value - Raw workspace path typed into the toolbar */
  changeWorkspaceInput: (value: string) => void;
  /** Opens the native directory picker and loads the selected workspace. */
  browseWorkspace: () => Promise<void>;
  /** Loads the workspace currently typed into the toolbar input. */
  loadWorkspaceFromInput: () => void;
  /** Clears the loaded workspace and all session messages. */
  resetWorkspace: () => void;
  /** @param path - Saved workspace path selected from the recent list */
  openRecentWorkspace: (path: string) => Promise<void>;
  /** Clears the dialog error message shown in the toolbar. */
  clearDialogError: () => void;
}>;

/**
 * Manages workspace open/browse/drop interactions and their error messages.
 *
 * @param options - Workspace loading state and the recent workspace store
 * @returns Workspace session state and open/reset operations.
 */
export function useWorkspaceSession({
  workspace,
  recentWorkspaces,
}: UseWorkspaceSessionOptions): UseWorkspaceSessionResult {
  const [workspaceInput, setWorkspaceInput] = useState("");
  const [isBrowsing, setIsBrowsing] = useState(false);
  const [dialogErrorMessage, setDialogErrorMessage] = useState<string | null>(
    null,
  );
  const [dropErrorMessage, setDropErrorMessage] = useState<string | null>(null);
  const hasAttemptedStartupRestoreRef = useRef(false);

  const loadWorkspacePath = useCallback(
    async (
      selectedDirectory: string,
      options: LoadWorkspacePathOptions = {},
    ): Promise<boolean> => {
      setDialogErrorMessage(null);
      setDropErrorMessage(null);
      setWorkspaceInput(selectedDirectory);
      const isLoaded = await workspace.load(selectedDirectory, {
        preserveCurrentWorkspace: options.preserveCurrentWorkspace,
        onWorkspaceLoaded: recentWorkspaces.recordWorkspace,
      });

      return isLoaded;
    },
    [recentWorkspaces.recordWorkspace, workspace.load],
  );

  const browseWorkspace = async (): Promise<void> => {
    if (workspace.isLoading || isBrowsing) {
      return;
    }

    setDialogErrorMessage(null);
    setIsBrowsing(true);

    try {
      const selectedDirectory = await selectWorkspaceDirectory();

      if (selectedDirectory === null) {
        return;
      }

      await loadWorkspacePath(selectedDirectory);
    } catch (error) {
      setDialogErrorMessage(normalizeCommandError(error).message);
    } finally {
      setIsBrowsing(false);
    }
  };

  const loadWorkspaceFromInput = (): void => {
    const selectedDirectory = workspaceInput.trim();

    if (selectedDirectory.length === 0) {
      return;
    }

    void loadWorkspacePath(selectedDirectory);
  };

  const resetWorkspace = (): void => {
    setWorkspaceInput("");
    setDialogErrorMessage(null);
    setDropErrorMessage(null);
    workspace.reset();
  };

  const openDroppedWorkspacePath = useCallback(
    async (selectedDirectory: string): Promise<void> => {
      if (workspace.isLoading || isBrowsing) {
        return;
      }

      setDialogErrorMessage(null);
      setDropErrorMessage(null);
      setWorkspaceInput(selectedDirectory);

      try {
        const validation = await validateWorkspaceDirectory(selectedDirectory);

        if (!validation.isDirectory) {
          setDropErrorMessage(invalidDroppedDirectoryMessage);
          return;
        }

        await loadWorkspacePath(selectedDirectory, {
          preserveCurrentWorkspace: true,
        });
      } catch (error) {
        setDropErrorMessage(normalizeCommandError(error).message);
      }
    },
    [isBrowsing, loadWorkspacePath, workspace.isLoading],
  );

  const openRecentWorkspace = useCallback(
    async (selectedDirectory: string): Promise<void> => {
      if (workspace.isLoading || isBrowsing) {
        return;
      }

      setDialogErrorMessage(null);
      setDropErrorMessage(null);
      setWorkspaceInput(selectedDirectory);

      try {
        const validation = await validateWorkspaceDirectory(selectedDirectory);

        if (!validation.isDirectory) {
          recentWorkspaces.removeWorkspace(selectedDirectory);
          setDialogErrorMessage(missingSavedWorkspaceMessage);
          setWorkspaceInput(workspace.workspace?.root ?? "");
          return;
        }

        const isLoaded = await loadWorkspacePath(selectedDirectory, {
          preserveCurrentWorkspace: true,
        });

        if (!isLoaded) {
          recentWorkspaces.removeWorkspace(selectedDirectory);
          setDialogErrorMessage(unsupportedSavedWorkspaceMessage);
          setWorkspaceInput(workspace.workspace?.root ?? "");
        }
      } catch (error) {
        recentWorkspaces.removeWorkspace(selectedDirectory);
        setDialogErrorMessage(
          `${missingSavedWorkspaceMessage} ${normalizeCommandError(error).message}`,
        );
        setWorkspaceInput(workspace.workspace?.root ?? "");
      }
    },
    [
      isBrowsing,
      loadWorkspacePath,
      recentWorkspaces.removeWorkspace,
      workspace.workspace?.root,
      workspace.isLoading,
    ],
  );

  useEffect(() => {
    if (hasAttemptedStartupRestoreRef.current) {
      return;
    }

    if (workspace.workspace !== null || workspace.isLoading || isBrowsing) {
      return;
    }

    if (recentWorkspaces.lastActiveWorkspacePath === null) {
      return;
    }

    hasAttemptedStartupRestoreRef.current = true;
    void openRecentWorkspace(recentWorkspaces.lastActiveWorkspacePath);
  }, [
    isBrowsing,
    openRecentWorkspace,
    recentWorkspaces.lastActiveWorkspacePath,
    workspace.isLoading,
    workspace.workspace,
  ]);

  const workspaceDrop = useWorkspaceDrop({
    isDisabled: workspace.isLoading || isBrowsing,
    onDropWorkspacePath: (selectedDirectory) => {
      void openDroppedWorkspacePath(selectedDirectory);
    },
    onInvalidDrop: setDropErrorMessage,
  });

  const toolbarErrorMessage =
    dropErrorMessage ?? dialogErrorMessage ?? workspace.error?.message ?? null;

  const clearDialogError = useCallback((): void => {
    setDialogErrorMessage(null);
  }, []);

  return {
    workspaceInput,
    isBrowsing,
    toolbarErrorMessage,
    isDropTargetActive: workspaceDrop.status === "dragging",
    changeWorkspaceInput: setWorkspaceInput,
    browseWorkspace,
    loadWorkspaceFromInput,
    resetWorkspace,
    openRecentWorkspace,
    clearDialogError,
  };
}
