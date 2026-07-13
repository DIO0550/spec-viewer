import { useCallback, useEffect, useMemo, useState } from "react";
import type { SpecDocumentFeatureState } from "@/features/specs/application/specError";
import { SpecDocumentState as SpecDocumentFeatureStateFactory } from "@/features/specs/domain/specDocumentState";
import { SpecNode as SpecNodeDomain } from "@/features/specs/domain/specNode";
import { SpecTree as SpecTreeDomain } from "@/features/specs/domain/specTree";
import type { SpecTreeFeatureState } from "@/features/specs/application/specError";
import { SpecTreeState as SpecTreeFeatureStateFactory } from "@/features/specs/domain/specTreeState";
import {
  buildSpecsSelectors,
  type SpecsSelectors,
} from "@/features/specs/hooks/useSpecs/selectors";
import type {
  SpecsActions,
  SpecsState,
  UseSpecsResult,
} from "@/features/specs/hooks/useSpecs/types";
import * as specGateway from "@/features/specs/infra/specGateway";
import { specCommands } from "@/features/specs/infra/tauri";
import { toSpecFeatureError } from "@/features/specs/infra/tauri/specErrorMapper";
import type { SpecFileKey } from "@/shared/domain/specFileKey";
import type { SpecId } from "@/shared/domain/specId";
import {
  createPerformanceCorrelationId,
  startPerformanceSpan,
} from "@/shared/lib/performance";

export type { SpecDocumentFeatureState as SpecDocumentState } from "@/features/specs/application/specError";
export type { SpecTreeFeatureState as SpecTreeState } from "@/features/specs/application/specError";
export type { UseSpecsResult } from "@/features/specs/hooks/useSpecs/types";

export type SpecSelectionChange = Readonly<{
  workspacePath: string | null;
  specId: SpecId | null;
  fileKey: SpecFileKey | null;
}>;

export type UseSpecsOptions = Readonly<{
  workspacePath: string | null;
  onSelectionChange?: (selection: SpecSelectionChange) => void;
}>;

const initialSpecTreeFeatureState: SpecTreeFeatureState =
  SpecTreeFeatureStateFactory.idle();
const initialDocumentState: SpecDocumentFeatureState =
  SpecDocumentFeatureStateFactory.idle(null);

type PreferredSelection = Readonly<{
  specId: SpecId | null;
  fileKey: SpecFileKey | null;
}>;

type ResolvedSelection = ReturnType<typeof SpecTreeDomain.resolveSelection>;

type ShouldCommitState = () => boolean;

const initialSpecsState: SpecsState = {
  specTreeState: initialSpecTreeFeatureState,
  documentState: initialDocumentState,
  selection: {
    specId: null,
    fileKey: null,
  },
  isLoading: false,
  activeOperationId: null,
  archivingSpecId: null,
  archiveSpecError: null,
};

/** @returns A unique id for guarding one spec load operation. */
function createSpecLoadOperationId(): string {
  return `spec-load-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2)}`;
}

/**
 * @param options - Hook options including the workspace path and selection callback.
 * @returns Spec tree, selection, and Markdown loading state for a workspace.
 */
export function useSpecs(options: UseSpecsOptions): UseSpecsResult {
  const { onSelectionChange, workspacePath } = options;
  const [state, setState] = useState<SpecsState>(initialSpecsState);
  const { isLoading, selection, specTreeState } = state;
  const selectedSpecId = selection.specId;
  const selectedFileKey = selection.fileKey;

  const commitLoadState = useCallback(
    (
      operationId: string,
      updateState: (currentState: SpecsState) => SpecsState,
    ): void => {
      setState((currentState) => {
        if (currentState.activeOperationId !== operationId) {
          return currentState;
        }

        return updateState(currentState);
      });
    },
    [],
  );

  const finishLoad = useCallback((operationId: string): void => {
    setState((currentState) => {
      if (currentState.activeOperationId !== operationId) {
        return currentState;
      }

      return {
        ...currentState,
        activeOperationId: null,
        isLoading: false,
      };
    });
  }, []);

  let isLoadStarting = isLoading;

  const runSpecLoad = useCallback(
    async (
      load: (operationId: string) => Promise<boolean>,
    ): Promise<boolean> => {
      if (isLoadStarting || isLoading) {
        return false;
      }

      isLoadStarting = true;
      const operationId = createSpecLoadOperationId();
      setState((currentState) => {
        if (currentState.isLoading) {
          return currentState;
        }

        return {
          ...currentState,
          activeOperationId: operationId,
          isLoading: true,
        };
      });

      try {
        return await load(operationId);
      } finally {
        isLoadStarting = false;
        finishLoad(operationId);
      }
    },
    [finishLoad, isLoading],
  );

  const resetSelection = useCallback((): void => {
    setState((currentState) => ({
      ...currentState,
      archivingSpecId: null,
      documentState: SpecDocumentFeatureStateFactory.idle(workspacePath),
      selection: {
        specId: null,
        fileKey: null,
      },
    }));
    onSelectionChange?.({
      workspacePath,
      specId: null,
      fileKey: null,
    });
  }, [onSelectionChange, workspacePath]);

  const loadDocument = useCallback(
    async (
      operationId: string,
      specId: SpecId,
      fileKey: SpecFileKey,
      activeWorkspacePath: string | null = workspacePath,
      canCommit: ShouldCommitState = () => true,
    ): Promise<boolean> => {
      if (!canCommit()) {
        return false;
      }

      if (activeWorkspacePath === null) {
        commitLoadState(operationId, (currentState) => ({
          ...currentState,
          documentState: SpecDocumentFeatureStateFactory.idle(
            activeWorkspacePath,
            specId,
            fileKey,
          ),
        }));
        return true;
      }

      const correlationId = createPerformanceCorrelationId("document-read");
      commitLoadState(operationId, (currentState) => ({
        ...currentState,
        documentState: SpecDocumentFeatureStateFactory.loading(
          activeWorkspacePath,
          specId,
          fileKey,
          correlationId,
        ),
      }));

      const endSpan = startPerformanceSpan(correlationId, "document.read", {
        specId,
        fileKey,
      });

      try {
        const document = await specGateway.readSpecFile(
          specCommands,
          specGateway.createReadSpecFileRequest({
            workspacePath: activeWorkspacePath,
            specId,
            fileKey,
            correlationId,
          }),
        );
        endSpan({
          bytes: document.contents?.length ?? 0,
          blockCount: document.blocks.length,
          missing: document.missing,
        });

        if (!canCommit()) {
          return false;
        }

        commitLoadState(operationId, (currentState) => ({
          ...currentState,
          documentState: SpecDocumentFeatureStateFactory.loaded(
            activeWorkspacePath,
            specId,
            fileKey,
            document,
            correlationId,
          ),
        }));
        return true;
      } catch (error) {
        endSpan({
          error: true,
        });

        if (!canCommit()) {
          return false;
        }

        commitLoadState(operationId, (currentState) => ({
          ...currentState,
          documentState: SpecDocumentFeatureStateFactory.failed(
            activeWorkspacePath,
            specId,
            fileKey,
            toSpecFeatureError("read", error),
            correlationId,
          ),
        }));
        return false;
      }
    },
    [commitLoadState, workspacePath],
  );

  const loadResolvedSelection = useCallback(
    async (
      operationId: string,
      activeWorkspacePath: string,
      selection: ResolvedSelection,
      canCommit: ShouldCommitState = () => true,
    ): Promise<boolean> => {
      if (!canCommit()) {
        return false;
      }

      commitLoadState(operationId, (currentState) => ({
        ...currentState,
        selection: {
          specId: selection.spec?.id ?? null,
          fileKey: selection.fileKey,
        },
      }));
      onSelectionChange?.({
        workspacePath: activeWorkspacePath,
        specId: selection.spec?.id ?? null,
        fileKey: selection.fileKey,
      });

      if (selection.spec === null || selection.fileKey === null) {
        commitLoadState(operationId, (currentState) => ({
          ...currentState,
          documentState:
            SpecDocumentFeatureStateFactory.idle(activeWorkspacePath),
        }));
        return true;
      }

      return await loadDocument(
        operationId,
        selection.spec.id,
        selection.fileKey,
        activeWorkspacePath,
        canCommit,
      );
    },
    [commitLoadState, loadDocument, onSelectionChange],
  );

  const loadSpecTree = useCallback(
    async (
      operationId: string,
      preferredSelection: PreferredSelection,
      canCommit: ShouldCommitState = () => true,
    ): Promise<boolean> => {
      if (!canCommit()) {
        return false;
      }

      if (workspacePath === null) {
        commitLoadState(operationId, (currentState) => ({
          ...currentState,
          documentState: SpecDocumentFeatureStateFactory.idle(null),
          selection: {
            specId: null,
            fileKey: null,
          },
          specTreeState: initialSpecTreeFeatureState,
        }));
        onSelectionChange?.({
          workspacePath,
          specId: null,
          fileKey: null,
        });
        return true;
      }

      const activeWorkspacePath = workspacePath;
      commitLoadState(operationId, (currentState) => ({
        ...currentState,
        specTreeState: SpecTreeFeatureStateFactory.loading(activeWorkspacePath),
      }));

      try {
        const tree = await specGateway.listSpecs(
          specCommands,
          activeWorkspacePath,
        );

        if (!canCommit()) {
          return false;
        }

        commitLoadState(operationId, (currentState) => ({
          ...currentState,
          specTreeState: SpecTreeFeatureStateFactory.loaded(
            activeWorkspacePath,
            tree,
          ),
        }));
        const nextSelection = SpecTreeDomain.resolveSelection(
          tree,
          preferredSelection,
        );

        return await loadResolvedSelection(
          operationId,
          activeWorkspacePath,
          nextSelection,
          canCommit,
        );
      } catch (error) {
        if (!canCommit()) {
          return false;
        }

        commitLoadState(operationId, (currentState) => ({
          ...currentState,
          documentState:
            SpecDocumentFeatureStateFactory.idle(activeWorkspacePath),
          selection: {
            specId: null,
            fileKey: null,
          },
          specTreeState: SpecTreeFeatureStateFactory.failed(
            activeWorkspacePath,
            toSpecFeatureError("list", error),
          ),
        }));
        onSelectionChange?.({
          workspacePath: activeWorkspacePath,
          specId: null,
          fileKey: null,
        });
        return false;
      }
    },
    [commitLoadState, loadResolvedSelection, onSelectionChange, workspacePath],
  );

  const reloadSpecs = useCallback(
    (): Promise<boolean> =>
      runSpecLoad((operationId) =>
        loadSpecTree(operationId, {
          specId: selectedSpecId,
          fileKey: selectedFileKey,
        }),
      ),
    [loadSpecTree, runSpecLoad, selectedFileKey, selectedSpecId],
  );

  useEffect(() => {
    const operationId = createSpecLoadOperationId();
    let cancelled = false;
    /** @returns Whether this effect run is still active and may commit state. */
    const canCommit = (): boolean => !cancelled;

    setState((currentState) => ({
      ...currentState,
      activeOperationId: operationId,
      archiveSpecError: null,
      archivingSpecId: null,
      documentState: SpecDocumentFeatureStateFactory.idle(workspacePath),
      isLoading: workspacePath !== null,
      selection: {
        specId: null,
        fileKey: null,
      },
      specTreeState:
        workspacePath === null
          ? initialSpecTreeFeatureState
          : SpecTreeFeatureStateFactory.loading(workspacePath),
    }));
    onSelectionChange?.({
      workspacePath,
      specId: null,
      fileKey: null,
    });

    if (workspacePath === null) {
      finishLoad(operationId);
      return () => {
        cancelled = true;
      };
    }

    void (async (): Promise<void> => {
      try {
        await loadSpecTree(
          operationId,
          { specId: null, fileKey: null },
          canCommit,
        );
      } finally {
        finishLoad(operationId);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [finishLoad, loadSpecTree, onSelectionChange, workspacePath]);

  const tree = specTreeState.tree;

  const selectSpec = useCallback(
    async (specId: SpecId): Promise<void> => {
      await runSpecLoad(async (operationId) => {
        const activeWorkspacePath = workspacePath;
        const nextSpec =
          tree === null ? null : SpecTreeDomain.find(tree, specId);

        if (nextSpec === null) {
          return false;
        }

        const defaultFileKey = SpecNodeDomain.firstFileKey(nextSpec);
        commitLoadState(operationId, (currentState) => ({
          ...currentState,
          selection: {
            specId,
            fileKey: defaultFileKey,
          },
        }));
        onSelectionChange?.({
          workspacePath: activeWorkspacePath,
          specId,
          fileKey: defaultFileKey,
        });

        if (defaultFileKey === null) {
          commitLoadState(operationId, (currentState) => ({
            ...currentState,
            documentState: SpecDocumentFeatureStateFactory.idle(
              activeWorkspacePath,
              specId,
            ),
          }));
          return true;
        }

        return await loadDocument(
          operationId,
          specId,
          defaultFileKey,
          activeWorkspacePath,
        );
      });
    },
    [
      commitLoadState,
      loadDocument,
      onSelectionChange,
      runSpecLoad,
      tree,
      workspacePath,
    ],
  );

  const selectFileKey = useCallback(
    async (fileKey: SpecFileKey): Promise<void> => {
      await runSpecLoad(async (operationId) => {
        const activeWorkspacePath = workspacePath;

        if (selectedSpecId === null) {
          return false;
        }

        commitLoadState(operationId, (currentState) => ({
          ...currentState,
          selection: {
            ...currentState.selection,
            fileKey,
          },
        }));
        onSelectionChange?.({
          workspacePath: activeWorkspacePath,
          specId: selectedSpecId,
          fileKey,
        });

        return await loadDocument(
          operationId,
          selectedSpecId,
          fileKey,
          activeWorkspacePath,
        );
      });
    },
    [
      commitLoadState,
      loadDocument,
      onSelectionChange,
      runSpecLoad,
      selectedSpecId,
      workspacePath,
    ],
  );

  const reloadDocument = useCallback(async (): Promise<boolean> => {
    if (selectedSpecId === null || selectedFileKey === null) {
      return true;
    }

    return await runSpecLoad((operationId) =>
      loadDocument(operationId, selectedSpecId, selectedFileKey, workspacePath),
    );
  }, [
    loadDocument,
    runSpecLoad,
    selectedFileKey,
    selectedSpecId,
    workspacePath,
  ]);

  const archiveSpec = useCallback(
    async (specId: SpecId): Promise<boolean> => {
      return await runSpecLoad(async (operationId) => {
        const activeWorkspacePath = workspacePath;

        if (activeWorkspacePath === null) {
          return false;
        }

        commitLoadState(operationId, (currentState) => ({
          ...currentState,
          archiveSpecError: null,
          archivingSpecId: specId,
        }));

        try {
          await specGateway.archiveSpec(specCommands, {
            workspacePath: activeWorkspacePath,
            specId,
          });

          return await loadSpecTree(operationId, {
            specId: selectedSpecId,
            fileKey: selectedFileKey,
          });
        } catch (error) {
          commitLoadState(operationId, (currentState) => ({
            ...currentState,
            archiveSpecError: toSpecFeatureError("archive", error),
          }));
          return false;
        } finally {
          commitLoadState(operationId, (currentState) => ({
            ...currentState,
            archivingSpecId: null,
          }));
        }
      });
    },
    [
      commitLoadState,
      loadSpecTree,
      runSpecLoad,
      selectedFileKey,
      selectedSpecId,
      workspacePath,
    ],
  );

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

  return {
    state,
    actions,
    selectors,
  };
}
