import { useCallback } from "react";

import type { SpecFileKey } from "@/features/specs";

export type UseGuardedSpecActionsOptions = Readonly<{
  isCurrentViewLoading: boolean;
  selectSpec: (specId: string) => Promise<unknown>;
  archiveSpec: (specId: string) => Promise<unknown>;
  reloadSpecs: () => Promise<unknown>;
  selectFileKey: (fileKey: SpecFileKey) => Promise<unknown>;
  reloadDocument: () => Promise<unknown>;
}>;

export type UseGuardedSpecActionsResult = Readonly<{
  selectSpecFromTree: (specId: string) => void;
  archiveSpecFromTree: (specId: string) => void;
  reloadSpecsFromTree: () => void;
  selectFileFromTabs: (fileKey: SpecFileKey) => void;
  reloadDocumentFromViewer: () => void;
}>;

/**
 * @param options - Loading guard flag and the spec actions to wrap.
 * @returns Spec tree/tabs/viewer actions that no-op while the current view is loading.
 */
export function useGuardedSpecActions(
  options: UseGuardedSpecActionsOptions,
): UseGuardedSpecActionsResult {
  const {
    isCurrentViewLoading,
    selectSpec,
    archiveSpec,
    reloadSpecs,
    selectFileKey,
    reloadDocument,
  } = options;

  const selectSpecFromTree = useCallback(
    (specId: string): void => {
      if (isCurrentViewLoading) {
        return;
      }

      void selectSpec(specId);
    },
    [isCurrentViewLoading, selectSpec],
  );

  const archiveSpecFromTree = useCallback(
    (specId: string): void => {
      if (isCurrentViewLoading) {
        return;
      }

      void archiveSpec(specId);
    },
    [isCurrentViewLoading, archiveSpec],
  );

  const reloadSpecsFromTree = useCallback((): void => {
    if (isCurrentViewLoading) {
      return;
    }

    void reloadSpecs();
  }, [isCurrentViewLoading, reloadSpecs]);

  const selectFileFromTabs = useCallback(
    (fileKey: SpecFileKey): void => {
      if (isCurrentViewLoading) {
        return;
      }

      void selectFileKey(fileKey);
    },
    [isCurrentViewLoading, selectFileKey],
  );

  const reloadDocumentFromViewer = useCallback((): void => {
    if (isCurrentViewLoading) {
      return;
    }

    void reloadDocument();
  }, [isCurrentViewLoading, reloadDocument]);

  return {
    selectSpecFromTree,
    archiveSpecFromTree,
    reloadSpecsFromTree,
    selectFileFromTabs,
    reloadDocumentFromViewer,
  };
}
