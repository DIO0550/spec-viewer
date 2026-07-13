import { useCallback } from "react";

import type { SpecFileKey } from "@/features/specs";
import type { SpecId } from "@/shared/domain/specId";

export type UseGuardedSpecActionsOptions = Readonly<{
  isCurrentViewLoading: boolean;
  /** Selects a spec. @param specId - Id of the spec to select. */
  selectSpec: (specId: SpecId) => Promise<unknown>;
  /** Archives a spec. @param specId - Id of the spec to archive. */
  archiveSpec: (specId: SpecId) => Promise<unknown>;
  /** Reloads the spec list. */
  reloadSpecs: () => Promise<unknown>;
  /** Selects a spec file. @param fileKey - Key of the file to select. */
  selectFileKey: (fileKey: SpecFileKey) => Promise<unknown>;
  /** Reloads the current document. */
  reloadDocument: () => Promise<unknown>;
}>;

export type UseGuardedSpecActionsResult = Readonly<{
  /** Selects a spec from the tree. @param specId - Id of the spec to select. */
  selectSpecFromTree: (specId: SpecId) => void;
  /** Archives a spec from the tree. @param specId - Id of the spec to archive. */
  archiveSpecFromTree: (specId: SpecId) => void;
  /** Reloads the spec list from the tree. */
  reloadSpecsFromTree: () => void;
  /** Selects a file from the tabs. @param fileKey - Key of the file to select. */
  selectFileFromTabs: (fileKey: SpecFileKey) => void;
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
    reloadDocument,
  } = options;

  const selectSpecFromTree = useCallback(
    (specId: SpecId): void => {
      if (isCurrentViewLoading) {
        return;
      }

      void selectSpec(specId);
    },
    [isCurrentViewLoading, selectSpec],
  );

  const archiveSpecFromTree = useCallback(
    (specId: SpecId): void => {
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
