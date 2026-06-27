import { useCallback, useEffect, useState } from "react";

import { SpecDocumentState as SpecDocumentStateFactory } from "@/features/specs/domain/specDocumentState";
import type { SpecDocumentState } from "@/features/specs/domain/specDocumentState";
import { SpecNode as SpecNodeDomain } from "@/features/specs/domain/specNode";
import { SpecTree as SpecTreeDomain } from "@/features/specs/domain/specTree";
import { SpecTreeState as SpecTreeStateFactory } from "@/features/specs/domain/specTreeState";
import type { SpecTreeState } from "@/features/specs/domain/specTreeState";
import * as specGateway from "@/features/specs/infra/specGateway";
import { normalizeCommandError, specCommands } from "@/shared/api/tauri";
import {
  createPerformanceCorrelationId,
  startPerformanceSpan,
} from "@/shared/lib/performance";
import type { NormalizedCommandError } from "@/shared/types/ipc";
import type {
  SpecFile,
  SpecFileKey,
  SpecNode,
} from "@/features/specs/types/spec";

export type { SpecDocumentState } from "@/features/specs/domain/specDocumentState";
export type { SpecTreeState } from "@/features/specs/domain/specTreeState";

export type SpecSelectionChange = Readonly<{
  workspacePath: string | null;
  specId: string | null;
  fileKey: SpecFileKey | null;
}>;

export type UseSpecsOptions = Readonly<{
  workspacePath: string | null;
  onSelectionChange?: (selection: SpecSelectionChange) => void;
}>;

export type UseSpecsResult = Readonly<{
  specTreeState: SpecTreeState;
  documentState: SpecDocumentState;
  selectedSpecId: string | null;
  selectedSpec: SpecNode | null;
  selectedFileKey: SpecFileKey | null;
  selectedFile: SpecFile | null;
  isLoading: boolean;
  archivingSpecId: string | null;
  archiveSpecError: NormalizedCommandError | null;
  archiveSpec: (specId: string) => Promise<boolean>;
  reloadSpecs: () => Promise<boolean>;
  selectSpec: (specId: string) => Promise<void>;
  selectFileKey: (fileKey: SpecFileKey) => Promise<void>;
  reloadDocument: () => Promise<boolean>;
  resetSelection: () => void;
}>;

const initialSpecTreeState: SpecTreeState = SpecTreeStateFactory.idle();
const initialDocumentState: SpecDocumentState =
  SpecDocumentStateFactory.idle(null);

type PreferredSelection = Readonly<{
  specId: string | null;
  fileKey: SpecFileKey | null;
}>;

type ResolvedSelection = ReturnType<typeof SpecTreeDomain.resolveSelection>;

type ShouldCommitState = () => boolean;

type SpecsState = Readonly<{
  specTreeState: SpecTreeState;
  documentState: SpecDocumentState;
  selectedSpecId: string | null;
  selectedFileKey: SpecFileKey | null;
  isLoading: boolean;
  activeOperationId: string | null;
  archivingSpecId: string | null;
  archiveSpecError: NormalizedCommandError | null;
}>;

const initialSpecsState: SpecsState = {
  specTreeState: initialSpecTreeState,
  documentState: initialDocumentState,
  selectedSpecId: null,
  selectedFileKey: null,
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

/** @returns Spec tree, selection, and Markdown loading state for a workspace. */
export function useSpecs(options: UseSpecsOptions): UseSpecsResult {
  const { onSelectionChange, workspacePath } = options;
  const [state, setState] = useState<SpecsState>(initialSpecsState);
  const {
    archiveSpecError,
    archivingSpecId,
    documentState,
    isLoading,
    selectedFileKey,
    selectedSpecId,
    specTreeState,
  } = state;

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
      documentState: SpecDocumentStateFactory.idle(workspacePath),
      selectedFileKey: null,
      selectedSpecId: null,
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
      specId: string,
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
          documentState: SpecDocumentStateFactory.idle(
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
        documentState: SpecDocumentStateFactory.loading(
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
          documentState: SpecDocumentStateFactory.loaded(
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
          documentState: SpecDocumentStateFactory.failed(
            activeWorkspacePath,
            specId,
            fileKey,
            normalizeCommandError(error),
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
        selectedFileKey: selection.fileKey,
        selectedSpecId: selection.spec?.id ?? null,
      }));
      onSelectionChange?.({
        workspacePath: activeWorkspacePath,
        specId: selection.spec?.id ?? null,
        fileKey: selection.fileKey,
      });

      if (selection.spec === null || selection.fileKey === null) {
        commitLoadState(operationId, (currentState) => ({
          ...currentState,
          documentState: SpecDocumentStateFactory.idle(activeWorkspacePath),
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
          documentState: SpecDocumentStateFactory.idle(null),
          selectedFileKey: null,
          selectedSpecId: null,
          specTreeState: initialSpecTreeState,
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
        specTreeState: SpecTreeStateFactory.loading(activeWorkspacePath),
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
          specTreeState: SpecTreeStateFactory.loaded(activeWorkspacePath, tree),
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
          documentState: SpecDocumentStateFactory.idle(activeWorkspacePath),
          selectedFileKey: null,
          selectedSpecId: null,
          specTreeState: SpecTreeStateFactory.failed(
            activeWorkspacePath,
            normalizeCommandError(error),
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
    const canCommit = (): boolean => !cancelled;

    setState((currentState) => ({
      ...currentState,
      activeOperationId: operationId,
      archivingSpecId: null,
      documentState: SpecDocumentStateFactory.idle(workspacePath),
      isLoading: workspacePath !== null,
      selectedFileKey: null,
      selectedSpecId: null,
      specTreeState:
        workspacePath === null
          ? initialSpecTreeState
          : SpecTreeStateFactory.loading(workspacePath),
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
  const selectedSpec =
    tree === null || selectedSpecId === null
      ? null
      : SpecTreeDomain.findNode(tree, selectedSpecId);
  const selectedFile = SpecNodeDomain.selectedFile(
    selectedSpec,
    selectedFileKey,
  );

  const selectSpec = useCallback(
    async (specId: string): Promise<void> => {
      await runSpecLoad(async (operationId) => {
        const activeWorkspacePath = workspacePath;
        const nextSpec =
          tree === null ? null : SpecTreeDomain.findNode(tree, specId);

        if (nextSpec === null) {
          return false;
        }

        const defaultFileKey = SpecNodeDomain.firstFileKey(nextSpec);
        commitLoadState(operationId, (currentState) => ({
          ...currentState,
          selectedFileKey: defaultFileKey,
          selectedSpecId: specId,
        }));
        onSelectionChange?.({
          workspacePath: activeWorkspacePath,
          specId,
          fileKey: defaultFileKey,
        });

        if (defaultFileKey === null) {
          commitLoadState(operationId, (currentState) => ({
            ...currentState,
            documentState: SpecDocumentStateFactory.idle(
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
          selectedFileKey: fileKey,
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
    async (specId: string): Promise<boolean> => {
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
            archiveSpecError: normalizeCommandError(error),
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

  return {
    specTreeState,
    documentState,
    selectedSpecId,
    selectedSpec,
    selectedFileKey,
    selectedFile,
    isLoading,
    archivingSpecId,
    archiveSpecError,
    archiveSpec,
    reloadSpecs,
    selectSpec,
    selectFileKey,
    reloadDocument,
    resetSelection,
  };
}
