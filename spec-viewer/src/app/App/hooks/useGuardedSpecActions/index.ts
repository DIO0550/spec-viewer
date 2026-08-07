import { useCallback } from "react";

import type { SpecFileKey } from "@/features/specs";

export type UseGuardedSpecActionsOptions = Readonly<{
  isCurrentViewLoading: boolean;
  /** Selects a spec. @param specId - Id of the spec to select. */
  selectSpec: (specId: string) => Promise<unknown>;
  /** Archives a spec. @param specId - Id of the spec to archive. */
  archiveSpec: (specId: string) => Promise<unknown>;
  /** Reloads the spec list. */
  reloadSpecs: () => Promise<unknown>;
  /** Selects a spec file. @param fileKey - Key of the file to select. */
  selectFileKey: (fileKey: SpecFileKey) => Promise<unknown>;
  /** Atomically selects a Spec file from Changes. */
  selectSpecFile?: (specId: string, fileKey: string) => Promise<unknown>;
  /** Reloads the current document. */
  reloadDocument: () => Promise<unknown>;
}>;

export type UseGuardedSpecActionsResult = Readonly<{
  /** Selects a spec from the tree. @param specId - Id of the spec to select. */
  selectSpecFromTree: (specId: string) => void;
  /** Archives a spec from the tree. @param specId - Id of the spec to archive. */
  archiveSpecFromTree: (specId: string) => void;
  /** Reloads the spec list from the tree. */
  reloadSpecsFromTree: () => void;
  /** Selects a file from the tabs. @param fileKey - Key of the file to select. */
  selectFileFromTabs: (fileKey: SpecFileKey) => void;
  /**
   * Selects one logical file from Changes.
   *
   * @param specId - Id of the spec the file belongs to.
   * @param fileKey - Key of the file to select.
   */
  selectSpecFileFromChanges: (specId: string, fileKey: string) => void;
  /** Reloads the document from the viewer. */
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
    selectSpecFile,
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

  const selectSpecFileFromChanges = useCallback(
    (specId: string, fileKey: string): void => {
      if (isCurrentViewLoading || selectSpecFile === undefined) {
        return;
      }

      void selectSpecFile(specId, fileKey);
    },
    [isCurrentViewLoading, selectSpecFile],
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
    selectSpecFileFromChanges,
    reloadDocumentFromViewer,
  };
}
