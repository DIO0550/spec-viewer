import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import type { SpecGateway } from "@/features/specs/application/ports/specGateway";
import { createSpecOperationRegistry } from "@/features/specs/application/specOperation";
import {
  createSpecsApplicationService,
  type SpecSelectionChange,
} from "@/features/specs/application/specsService";
import {
  createInitialSpecsState,
  reduceSpecsState,
} from "@/features/specs/application/specsState";
import {
  buildSpecsSelectors,
  type SpecsSelectors,
} from "@/features/specs/hooks/useSpecs/selectors";
import type {
  SpecsActions,
  UseSpecsResult,
} from "@/features/specs/hooks/useSpecs/types";
import type { SpecFileKey } from "@/shared/domain/specFileKey";
import type { SpecId } from "@/shared/domain/specId";
import { WorkspacePath } from "@/shared/domain/workspacePath";

export type {
  SpecDocumentFeatureState as SpecDocumentState,
  SpecTreeFeatureState as SpecTreeState,
} from "@/features/specs/application/specError";
export type { SpecSelectionChange } from "@/features/specs/application/specsService";
export type { UseSpecsResult } from "@/features/specs/hooks/useSpecs/types";

export type UseSpecsOptions = Readonly<{
  gateway: SpecGateway;
  workspacePath: string | null;
  onSelectionChange?: (selection: SpecSelectionChange) => void;
}>;

/**
 * @param options - Injected gateway, workspace path, and selection callback.
 * @returns Spec tree, selection, document state, and public actions.
 */
export function useSpecs(options: UseSpecsOptions): UseSpecsResult {
  const { gateway, onSelectionChange, workspacePath } = options;
  const [state, dispatch] = useReducer(
    reduceSpecsState,
    undefined,
    createInitialSpecsState,
  );
  const stateRef = useRef(state);
  const onSelectionChangeRef = useRef(onSelectionChange);
  stateRef.current = state;
  onSelectionChangeRef.current = onSelectionChange;

  const activeWorkspacePath = useMemo(
    () =>
      workspacePath === null ? null : WorkspacePath.fromString(workspacePath),
    [workspacePath],
  );
  const operationRegistry = useMemo(createSpecOperationRegistry, []);
  const service = useMemo(
    () =>
      createSpecsApplicationService({
        gateway,
        operationRegistry,
        dispatch,
        onSelectionChange: (selection) =>
          onSelectionChangeRef.current?.(selection),
      }),
    [gateway, operationRegistry],
  );

  useEffect(() => {
    void service.synchronizeWorkspace(activeWorkspacePath);
    return service.cancelWorkspace;
  }, [activeWorkspacePath, service]);

  const reloadSpecs = useCallback(async (): Promise<boolean> => {
    if (activeWorkspacePath === null) {
      return true;
    }

    return await service.reloadSpecs({
      workspacePath: activeWorkspacePath,
      preferredSelection: stateRef.current.selection,
    });
  }, [activeWorkspacePath, service]);

  const selectSpec = useCallback(
    async (specId: SpecId): Promise<void> => {
      const tree = stateRef.current.specTreeState.tree;
      if (activeWorkspacePath === null || tree === null) {
        return;
      }

      await service.selectSpec({
        workspacePath: activeWorkspacePath,
        tree,
        specId,
      });
    },
    [activeWorkspacePath, service],
  );

  const selectFileKey = useCallback(
    async (fileKey: SpecFileKey): Promise<void> => {
      const snapshot = stateRef.current;
      const tree = snapshot.specTreeState.tree;
      const specId = snapshot.selection.specId;
      if (activeWorkspacePath === null || tree === null || specId === null) {
        return;
      }

      await service.selectFile({
        workspacePath: activeWorkspacePath,
        tree,
        specId,
        fileKey,
      });
    },
    [activeWorkspacePath, service],
  );

  const reloadDocument = useCallback(async (): Promise<boolean> => {
    const selection = stateRef.current.selection;
    if (
      activeWorkspacePath === null ||
      selection.specId === null ||
      selection.fileKey === null
    ) {
      return true;
    }

    return await service.reloadDocument({
      workspacePath: activeWorkspacePath,
      specId: selection.specId,
      fileKey: selection.fileKey,
    });
  }, [activeWorkspacePath, service]);

  const archiveSpec = useCallback(
    async (specId: SpecId): Promise<boolean> => {
      if (activeWorkspacePath === null) {
        return false;
      }

      return await service.archiveSpec({
        workspacePath: activeWorkspacePath,
        specId,
        preferredSelection: stateRef.current.selection,
      });
    },
    [activeWorkspacePath, service],
  );

  const resetSelection = useCallback((): void => {
    service.resetSelection(activeWorkspacePath);
  }, [activeWorkspacePath, service]);

  const selectors: SpecsSelectors = useMemo(
    () => buildSpecsSelectors(state),
    [state],
  );
  const actions: SpecsActions = useMemo(
    () => ({
      archiveSpec,
      reloadSpecs,
      selectSpec,
      selectFileKey,
      reloadDocument,
      resetSelection,
    }),
    [
      archiveSpec,
      reloadDocument,
      reloadSpecs,
      resetSelection,
      selectFileKey,
      selectSpec,
    ],
  );

  return { state, actions, selectors };
}
