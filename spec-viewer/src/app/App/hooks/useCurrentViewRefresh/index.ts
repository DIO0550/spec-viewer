import { useCallback, useEffect, useState } from "react";

import { useSpecFileWatcher } from "@/features/specs";
import type { SpecFileKey } from "@/features/specs/types/spec";
import type { WorkspaceRefreshStatus } from "@/features/workspace";
import { normalizeCommandError } from "@/shared/api/tauri";

const idleRefreshStatus: WorkspaceRefreshStatus = {
  status: "idle",
  message: null,
};

const staleViewMessage =
  "自動再読み込みに失敗しました。内容が古い可能性があります。";
const manualRefreshFailureMessage =
  "再読み込みに失敗しました。エラーを確認して再試行してください。";
const reloadingMarkdownMessage = "Markdown変更を反映中";
const reloadingConfigMessage = "Spec設定変更を反映中";
const reloadingCurrentViewMessage = "現在の表示を再読み込み中";

type RefreshRunOptions = Readonly<{
  loadingMessage: string;
  failureStatus: "stale" | "error";
  failureMessage: string;
  /** @returns Whether every reload in the refresh succeeded. */
  run: () => Promise<boolean>;
}>;

type UseCurrentViewRefreshOptions = Readonly<{
  workspacePath: string | null;
  specId: string | null;
  fileKey: SpecFileKey | null;
  /** Reloads the displayed document. */
  reloadDocument: () => Promise<boolean>;
  /** Reloads the spec tree while preserving the current selection. */
  reloadSpecs: () => Promise<boolean>;
  /** Reloads comments for the current scope. */
  reloadComments: () => Promise<boolean>;
  /** Notifies that a refresh started so stale messages can be cleared. */
  onRefreshStarted?: () => void;
}>;

type UseCurrentViewRefreshResult = Readonly<{
  refreshStatus: WorkspaceRefreshStatus;
  canRefresh: boolean;
  /** Reloads specs and comments for the current view on user request. */
  refreshCurrentView: () => Promise<void>;
}>;

/**
 * Keeps the displayed document fresh via file watching and manual refresh.
 *
 * @param options - Current selection and reload commands for specs/comments
 * @returns Refresh progress state and the manual refresh operation.
 */
export function useCurrentViewRefresh({
  workspacePath,
  specId,
  fileKey,
  reloadDocument,
  reloadSpecs,
  reloadComments,
  onRefreshStarted,
}: UseCurrentViewRefreshOptions): UseCurrentViewRefreshResult {
  const [refreshStatus, setRefreshStatus] =
    useState<WorkspaceRefreshStatus>(idleRefreshStatus);

  useEffect(() => {
    setRefreshStatus(idleRefreshStatus);
  }, [fileKey, specId, workspacePath]);

  const runRefresh = useCallback(
    async ({
      loadingMessage,
      failureStatus,
      failureMessage,
      run,
    }: RefreshRunOptions): Promise<boolean> => {
      onRefreshStarted?.();
      setRefreshStatus({
        status: "loading",
        message: loadingMessage,
      });

      try {
        const isRefreshSuccessful = await run();

        if (!isRefreshSuccessful) {
          setRefreshStatus({
            status: failureStatus,
            message: failureMessage,
          });
          return false;
        }

        setRefreshStatus(idleRefreshStatus);
        return true;
      } catch (error) {
        setRefreshStatus({
          status: failureStatus,
          message: `${failureMessage} ${normalizeCommandError(error).message}`,
        });
        return false;
      }
    },
    [onRefreshStarted],
  );

  const reloadCurrentMarkdownFromWatcher =
    useCallback(async (): Promise<void> => {
      await runRefresh({
        loadingMessage: reloadingMarkdownMessage,
        failureStatus: "stale",
        failureMessage: staleViewMessage,
        run: async () => {
          const isDocumentReloaded = await reloadDocument();
          const areCommentsReloaded = await reloadComments();
          return isDocumentReloaded && areCommentsReloaded;
        },
      });
    }, [reloadComments, reloadDocument, runRefresh]);

  const reloadWorkspaceConfigFromWatcher =
    useCallback(async (): Promise<void> => {
      await runRefresh({
        loadingMessage: reloadingConfigMessage,
        failureStatus: "stale",
        failureMessage: staleViewMessage,
        run: async () => {
          const areSpecsReloaded = await reloadSpecs();
          const areCommentsReloaded = await reloadComments();
          return areSpecsReloaded && areCommentsReloaded;
        },
      });
    }, [reloadComments, reloadSpecs, runRefresh]);

  const canRefresh =
    workspacePath !== null && specId !== null && fileKey !== null;

  const refreshCurrentView = useCallback(async (): Promise<void> => {
    if (!canRefresh || refreshStatus.status === "loading") {
      return;
    }

    await runRefresh({
      loadingMessage: reloadingCurrentViewMessage,
      failureStatus: "error",
      failureMessage: manualRefreshFailureMessage,
      run: async () => {
        const areSpecsReloaded = await reloadSpecs();
        const areCommentsReloaded = await reloadComments();
        return areSpecsReloaded && areCommentsReloaded;
      },
    });
  }, [
    canRefresh,
    refreshStatus.status,
    reloadComments,
    reloadSpecs,
    runRefresh,
  ]);

  useSpecFileWatcher({
    workspacePath,
    specId,
    fileKey,
    onMarkdownChange: reloadCurrentMarkdownFromWatcher,
    onConfigChange: reloadWorkspaceConfigFromWatcher,
    onWatcherError: (event) => {
      setRefreshStatus({
        status: "stale",
        message: `ファイル監視に失敗しました。内容が古い可能性があります。${event.message}`,
      });
    },
  });

  return { refreshStatus, canRefresh, refreshCurrentView };
}
