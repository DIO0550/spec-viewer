import { useCallback, useEffect, useMemo, useState } from "react";

import { useWorkspace } from "@/features/workspace/context/hooks";
import {
  selectActiveWorkspaceRoot,
  selectIsWorkspaceOpening,
  selectWorkspace,
  selectWorkspaceError,
} from "@/features/workspace/context/selectors";
import { useRecentWorkspaces } from "@/features/workspace/hooks/useRecentWorkspaces";
import { useWorkspaceDrop } from "@/features/workspace/hooks/useWorkspaceDrop";
import * as workspaceLoaderFlow from "@/features/workspace/hooks/useWorkspaceLoader/flow";
import type {
  OpenDroppedWorkspaceOutcome,
  OpenRecentWorkspaceOutcome,
  UseWorkspaceLoaderOptions,
  UseWorkspaceLoaderResult,
  WorkspaceLoaderCommands,
  WorkspaceLoaderFlowIo,
} from "@/features/workspace/hooks/useWorkspaceLoader/types";
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
 * @param options - Shared error sink plus test-only DI (commands / storage / workspace override).
 * @returns Workspace open/restore/drop state and guarded loader actions.
 */
export function useWorkspaceLoader(
  options: UseWorkspaceLoaderOptions,
): UseWorkspaceLoaderResult {
  const workspaceFromContext = useWorkspace();
  const workspace = options.workspace ?? workspaceFromContext;
  const recentWorkspaces = useRecentWorkspaces(
    options.recentWorkspacesStorage === undefined
      ? {}
      : { storage: options.recentWorkspacesStorage },
  );

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

  // io ラッパー: 各 IPC 呼び出しの直前に「クリア + input 更新」を合成する（途中経過の等価維持）。
  const flowIo: WorkspaceLoaderFlowIo = useMemo(() => {
    /**
     * 各 IPC 呼び出しの直前にエラー表示をクリアし、入力欄へパスを反映する。
     * @param path - 開こうとしているワークスペースディレクトリパス。
     */
    const applyOpenProgress = (path: string): void => {
      onError(null);
      setDropErrorMessage(null);
      setWorkspaceInput(path);
    };

    return {
      /** @param path - 検証対象のワークスペースディレクトリパス。 */
      validate: (path) => {
        applyOpenProgress(path);
        return validateWorkspaceDirectory(path);
      },
      /**
       * @param path - 読み込むワークスペースディレクトリパス。
       * @param preserveCurrentWorkspace - 失敗時に現在のワークスペースを保持するか。
       */
      load: (path, preserveCurrentWorkspace) => {
        applyOpenProgress(path);
        return workspaceLoad(path, {
          preserveCurrentWorkspace,
          onWorkspaceLoaded: recordWorkspace,
        });
      },
    };
  }, [onError, recordWorkspace, validateWorkspaceDirectory, workspaceLoad]);

  /**
   * ドロップ結果を状態へ適用する（ディレクトリでない/例外時はエラー表示）。
   * @param outcome - openDroppedWorkspacePath の判定結果。
   */
  const applyDropOutcome = (outcome: OpenDroppedWorkspaceOutcome): void => {
    if (outcome.type === "notDirectory" || outcome.type === "dropException") {
      setDropErrorMessage(outcome.dropMessage);
    }
  };

  const applyRecentOutcome = useCallback(
    (outcome: OpenRecentWorkspaceOutcome): void => {
      if (
        outcome.type === "recentMissing" ||
        outcome.type === "recentUnsupported" ||
        outcome.type === "recentException"
      ) {
        removeWorkspace(outcome.removePath);
        onError(outcome.dialogMessage);
        setWorkspaceInput(outcome.rollbackInput);
      }
    },
    [onError, removeWorkspace],
  );

  /** ネイティブのディレクトリ選択ダイアログを開き、選択したワークスペースを読み込む。 */
  const browseWorkspace = async (): Promise<void> => {
    if (
      workspaceLoaderFlow.isEntryGuarded({
        isWorkspaceOpening,
        isBrowsingWorkspace,
      })
    ) {
      return;
    }

    onError(null);
    setIsBrowsingWorkspace(true);

    try {
      const selectedDirectory = await selectWorkspaceDirectory();

      if (selectedDirectory === null) {
        return;
      }

      await workspaceLoaderFlow.openWorkspacePath(selectedDirectory, flowIo);
    } catch (error) {
      onError(getUnknownErrorMessage(error));
    } finally {
      setIsBrowsingWorkspace(false);
    }
  };

  /** 入力欄のパスからワークスペースを読み込む。 */
  const loadWorkspace = (): void => {
    void workspaceLoaderFlow.openWorkspaceFromInput(workspaceInput, flowIo);
  };

  const openRecentWorkspacePath = useCallback(
    async (path: string): Promise<void> => {
      const outcome = await workspaceLoaderFlow.openRecentWorkspacePath(
        path,
        { isWorkspaceOpening, isBrowsingWorkspace },
        activeWorkspaceRoot,
        flowIo,
      );
      applyRecentOutcome(outcome);
    },
    [
      activeWorkspaceRoot,
      applyRecentOutcome,
      flowIo,
      isBrowsingWorkspace,
      isWorkspaceOpening,
    ],
  );

  /** 現在のワークスペースと入力・エラー状態をリセットする。 */
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
    void openRecentWorkspacePath(recentWorkspaces.lastActiveWorkspacePath);
  }, [
    currentWorkspace,
    hasAttemptedStartupRestore,
    isBrowsingWorkspace,
    isWorkspaceOpening,
    openRecentWorkspacePath,
    recentWorkspaces.lastActiveWorkspacePath,
  ]);

  const workspaceDrop = useWorkspaceDrop({
    isDisabled: isWorkspaceOpening || isBrowsingWorkspace,
    /** @param path - ドロップされたワークスペースディレクトリパス。 */
    onDropWorkspacePath: (path) => {
      void workspaceLoaderFlow
        .openDroppedWorkspacePath(
          path,
          { isWorkspaceOpening, isBrowsingWorkspace },
          flowIo,
        )
        .then(applyDropOutcome);
    },
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
