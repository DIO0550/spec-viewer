import { useCallback } from "react";
import type { SpecViewResetKeys } from "@/app/App/hooks/types";
import { useSpecFileWatcher } from "@/features/specs";
import type {
  SpecFileWatchSubscriber,
  StartSpecFileWatchCommand,
  StopSpecFileWatchCommand,
} from "@/features/specs/hooks/useSpecFileWatcher";
import { getUnknownErrorMessage } from "@/utils/errorMessage";

type RefreshCurrentViewOptions = Readonly<{
  failureMessage: string;
  /** Runs the reload work, resolving to whether it succeeded. */
  run: () => Promise<boolean>;
}>;

export type UseViewRefreshOptions = Readonly<{
  selection: SpecViewResetKeys;
  isCurrentViewLoading: boolean;
  reload: Readonly<{
    /** Reloads the current document. */
    document: () => Promise<boolean>;
    /** Reloads the spec list. */
    specs: () => Promise<boolean>;
    /** Reloads the comments. */
    comments: () => Promise<boolean>;
    /** Reloads the diff overview and selected detail when connected. */
    diff?: () => Promise<boolean>;
  }>;
  /** Reports an error message, or clears it. @param message - Error message, or null to clear. */
  onError: (message: string | null) => void;
  watcher?: Readonly<{
    startWatch?: StartSpecFileWatchCommand;
    stopWatch?: StopSpecFileWatchCommand;
    subscribe?: SpecFileWatchSubscriber;
  }>;
}>;

export type UseViewRefreshResult = Readonly<{
  /** Manually refreshes the current view. */
  refreshCurrentViewManually: () => Promise<void>;
}>;

const autoReloadFailureMessage =
  "自動再読み込みに失敗しました。内容が古い可能性があります。";
const manualReloadFailureMessage =
  "再読み込みに失敗しました。エラーを確認して再試行してください。";

/**
 * @param options - Current selection, loading flag, reload callbacks, error sink and watcher DI.
 * @returns Manual refresh action wired to the spec file watcher auto-reloads.
 */
export function useViewRefresh(
  options: UseViewRefreshOptions,
): UseViewRefreshResult {
  const { selection, isCurrentViewLoading, reload, onError, watcher } = options;
  const workspaceRoot = selection.workspaceRoot;
  const specId = selection.specId;
  const fileKey = selection.fileKey;

  const refreshCurrentView = useCallback(
    async ({
      failureMessage,
      run,
    }: RefreshCurrentViewOptions): Promise<boolean> => {
      onError(null);

      try {
        const isRefreshSuccessful = await run();

        if (!isRefreshSuccessful) {
          onError(failureMessage);
          return false;
        }

        return true;
      } catch (error) {
        onError(`${failureMessage} ${getUnknownErrorMessage(error)}`);
        return false;
      }
    },
    [onError],
  );

  const reloadCurrentMarkdownFromWatcher =
    useCallback(async (): Promise<void> => {
      if (isCurrentViewLoading) {
        return;
      }

      await refreshCurrentView({
        failureMessage: autoReloadFailureMessage,
        /** Reloads the current document and its comments. */
        run: async () => {
          const isDocumentReloaded = await reload.document();
          const areCommentsReloaded = await reload.comments();
          const isDiffReloaded = await (reload.diff?.() ??
            Promise.resolve(true));
          return isDocumentReloaded && areCommentsReloaded && isDiffReloaded;
        },
      });
    }, [isCurrentViewLoading, refreshCurrentView, reload]);

  const reloadWorkspaceConfigFromWatcher =
    useCallback(async (): Promise<void> => {
      if (isCurrentViewLoading) {
        return;
      }

      await refreshCurrentView({
        failureMessage: autoReloadFailureMessage,
        /** Reloads the spec list and comments. */
        run: async () => {
          const areSpecsReloaded = await reload.specs();
          const areCommentsReloaded = await reload.comments();
          const isDiffReloaded = await (reload.diff?.() ??
            Promise.resolve(true));
          return areSpecsReloaded && areCommentsReloaded && isDiffReloaded;
        },
      });
    }, [isCurrentViewLoading, refreshCurrentView, reload]);

  const refreshCurrentViewManually = useCallback(async (): Promise<void> => {
    if (
      workspaceRoot === null ||
      specId === null ||
      fileKey === null ||
      isCurrentViewLoading
    ) {
      return;
    }

    await refreshCurrentView({
      failureMessage: manualReloadFailureMessage,
      /** Reloads the spec list and comments. */
      run: async () => {
        const areSpecsReloaded = await reload.specs();
        const areCommentsReloaded = await reload.comments();
        const isDiffReloaded = await (reload.diff?.() ?? Promise.resolve(true));
        return areSpecsReloaded && areCommentsReloaded && isDiffReloaded;
      },
    });
  }, [
    fileKey,
    isCurrentViewLoading,
    refreshCurrentView,
    reload,
    specId,
    workspaceRoot,
  ]);

  const handleWatcherError = useCallback(
    (event: Readonly<{ message: string }>): void => {
      onError(
        `ファイル監視に失敗しました。内容が古い可能性があります。${event.message}`,
      );
    },
    [onError],
  );

  useSpecFileWatcher({
    workspacePath: workspaceRoot,
    specId,
    fileKey,
    onMarkdownChange: reloadCurrentMarkdownFromWatcher,
    onConfigChange: reloadWorkspaceConfigFromWatcher,
    onWatcherError: handleWatcherError,
    startWatch: watcher?.startWatch,
    stopWatch: watcher?.stopWatch,
    subscribe: watcher?.subscribe,
  });

  return {
    refreshCurrentViewManually,
  };
}
