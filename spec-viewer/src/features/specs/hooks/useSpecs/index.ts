import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SpecDocumentState } from "@/features/specs/domain/specDocumentState";
import { SpecDocumentState as SpecDocumentStateFactory } from "@/features/specs/domain/specDocumentState";
import { OperationId } from "@/features/specs/domain/operationId";
import { SpecFeatureError } from "@/features/specs/domain/specError";
import { SpecNode as SpecNodeDomain } from "@/features/specs/domain/specNode";
import { SpecTree as SpecTreeDomain } from "@/features/specs/domain/specTree";
import type { SpecTreeState } from "@/features/specs/domain/specTreeState";
import { SpecTreeState as SpecTreeStateFactory } from "@/features/specs/domain/specTreeState";
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
import type {
  SpecDocument,
  SpecFileKey,
  SpecFileScope,
} from "@/features/specs/types/spec";
import { specCommands } from "@/lib/api/tauri";
import { ArchiveSpecCommandError } from "@/lib/api/tauri/archiveSpec";
import { ListSpecsCommandError } from "@/lib/api/tauri/listSpecs";
import { ReadSpecFileCommandError } from "@/lib/api/tauri/readSpecFile";
import { createPerformanceCorrelationId } from "@/lib/performance";

export type { SpecDocumentState } from "@/features/specs/domain/specDocumentState";
export type { SpecTreeState } from "@/features/specs/domain/specTreeState";
export type { UseSpecsResult } from "@/features/specs/hooks/useSpecs/types";

export type SpecSelectionChange = Readonly<{
  workspacePath: string | null;
  specId: string | null;
  fileKey: SpecFileKey | null;
}>;

export type UseSpecsOptions = Readonly<{
  workspacePath: string | null;
  onSelectionChange?: (selection: SpecSelectionChange) => void;
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
type OnSpecTreeLoaded = (tree: NonNullable<SpecTreeState["tree"]>) => void;

type LoadDocumentContext = Readonly<{
  operationId: OperationId;
  target: SpecFileScope;
}>;

type ReadDocumentInput = Readonly<{
  target: SpecFileScope;
  correlationId: string;
}>;

type ReadDocumentResult = Readonly<
  | {
      status: "success";
      document: SpecDocument;
      correlationId: string;
    }
  | {
      status: "error";
      error: SpecFeatureError;
      correlationId: string;
    }
>;

/**
 * Reads one spec document and normalizes the command boundary result.
 * @param input - Document scope and correlation id for the read operation.
 * @returns A successful document result or a normalized feature error.
 */
async function readDocument(
  input: ReadDocumentInput,
): Promise<ReadDocumentResult> {
  const { correlationId, target } = input;

  try {
    const document = await specGateway.readSpecFile(
      specCommands,
      specGateway.createReadSpecFileRequest({
        ...target,
        correlationId,
      }),
    );

    return {
      status: "success",
      document,
      correlationId,
    };
  } catch (error) {
    return {
      status: "error",
      error: SpecFeatureError.fromCommandError(
        ReadSpecFileCommandError.fromUnknown(error),
      ),
      correlationId,
    };
  }
}

const initialSpecsState: SpecsState = {
  specTreeState: initialSpecTreeState,
  documentState: initialDocumentState,
  selection: {
    specId: null,
    fileKey: null,
  },
  isLoading: false,
  activeOperationId: null,
  archivingSpecId: null,
  archiveSpecError: null,
  archiveFailure: null,
  archiveReveal: null,
};

/**
 * @param options - Hook options including the workspace path and selection callback.
 * @returns Spec tree, selection, and Markdown loading state for a workspace.
 */
export function useSpecs(options: UseSpecsOptions): UseSpecsResult {
  const { onSelectionChange, workspacePath } = options;
  const [state, setState] = useState<SpecsState>(initialSpecsState);
  const workspacePathRef = useRef(workspacePath);
  workspacePathRef.current = workspacePath;
  const { isLoading, selection, specTreeState } = state;
  const selectedSpecId = selection.specId;
  const selectedFileKey = selection.fileKey;

  const commitLoadState = useCallback(
    (
      operationId: OperationId,
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

  const finishLoad = useCallback((operationId: OperationId): void => {
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
      load: (operationId: OperationId) => Promise<boolean>,
    ): Promise<boolean> => {
      if (isLoadStarting || isLoading) {
        return false;
      }

      isLoadStarting = true;
      const operationId = OperationId.create();
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
    async ({ operationId, target }: LoadDocumentContext): Promise<boolean> => {
      const { fileKey, specId, workspacePath: activeWorkspacePath } = target;
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

      const result = await readDocument({ target, correlationId });

      if (result.status === "success") {
        commitLoadState(operationId, (currentState) => ({
          ...currentState,
          documentState: SpecDocumentStateFactory.loaded(
            activeWorkspacePath,
            specId,
            fileKey,
            result.document,
            correlationId,
          ),
        }));
        return true;
      }

      commitLoadState(operationId, (currentState) => ({
        ...currentState,
        documentState: SpecDocumentStateFactory.failed(
          activeWorkspacePath,
          specId,
          fileKey,
          result.error,
          correlationId,
        ),
      }));
      return false;
    },
    [commitLoadState],
  );

  const loadResolvedSelection = useCallback(
    async (
      operationId: OperationId,
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
          documentState: SpecDocumentStateFactory.idle(activeWorkspacePath),
        }));
        return true;
      }

      return await loadDocument({
        operationId,
        target: {
          workspacePath: activeWorkspacePath,
          specId: selection.spec.id,
          fileKey: selection.fileKey,
        },
      });
    },
    [commitLoadState, loadDocument, onSelectionChange],
  );

  const loadSpecTree = useCallback(
    async (
      operationId: OperationId,
      preferredSelection: PreferredSelection,
      canCommit: ShouldCommitState = () => true,
      onTreeLoaded?: OnSpecTreeLoaded,
    ): Promise<boolean> => {
      if (!canCommit()) {
        return false;
      }

      if (workspacePath === null) {
        commitLoadState(operationId, (currentState) => ({
          ...currentState,
          documentState: SpecDocumentStateFactory.idle(null),
          selection: {
            specId: null,
            fileKey: null,
          },
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
        onTreeLoaded?.(tree);
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
          selection: {
            specId: null,
            fileKey: null,
          },
          specTreeState: SpecTreeStateFactory.failed(
            activeWorkspacePath,
            SpecFeatureError.fromCommandError(
              ListSpecsCommandError.fromUnknown(error),
            ),
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
    const operationId = OperationId.create();
    let cancelled = false;
    /** @returns Whether this effect run is still active and may commit state. */
    const canCommit = (): boolean => !cancelled;

    setState((currentState) => ({
      ...currentState,
      activeOperationId: operationId,
      archiveSpecError: null,
      archiveFailure: null,
      archiveReveal: null,
      archivingSpecId: null,
      documentState: SpecDocumentStateFactory.idle(workspacePath),
      isLoading: workspacePath !== null,
      selection: {
        specId: null,
        fileKey: null,
      },
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
            documentState: SpecDocumentStateFactory.idle(
              activeWorkspacePath,
              specId,
            ),
          }));
          return true;
        }

        if (activeWorkspacePath === null) {
          commitLoadState(operationId, (currentState) => ({
            ...currentState,
            documentState: SpecDocumentStateFactory.idle(
              activeWorkspacePath,
              specId,
              defaultFileKey,
            ),
          }));
          return true;
        }

        return await loadDocument({
          operationId,
          target: {
            workspacePath: activeWorkspacePath,
            specId,
            fileKey: defaultFileKey,
          },
        });
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

        if (activeWorkspacePath === null) {
          commitLoadState(operationId, (currentState) => ({
            ...currentState,
            documentState: SpecDocumentStateFactory.idle(
              activeWorkspacePath,
              selectedSpecId,
              fileKey,
            ),
          }));
          return true;
        }

        return await loadDocument({
          operationId,
          target: {
            workspacePath: activeWorkspacePath,
            specId: selectedSpecId,
            fileKey,
          },
        });
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

    return await runSpecLoad(async (operationId) => {
      if (workspacePath === null) {
        commitLoadState(operationId, (currentState) => ({
          ...currentState,
          documentState: SpecDocumentStateFactory.idle(
            workspacePath,
            selectedSpecId,
            selectedFileKey,
          ),
        }));
        return true;
      }

      return loadDocument({
        operationId,
        target: {
          workspacePath,
          specId: selectedSpecId,
          fileKey: selectedFileKey,
        },
      });
    });
  }, [
    commitLoadState,
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
          archiveFailure: null,
          archiveReveal: null,
          archivingSpecId: specId,
        }));

        try {
          const response = await specGateway.archiveSpec(specCommands, {
            workspacePath: activeWorkspacePath,
            specId,
          });

          return await loadSpecTree(
            operationId,
            {
              specId: selectedSpecId,
              fileKey: selectedFileKey,
            },
            () => workspacePathRef.current === activeWorkspacePath,
            (loadedTree) => {
              const destination = SpecTreeDomain.findNodeByIdentity(loadedTree, {
                sourceGroupId: response.sourceGroupId,
                relativeId: response.destinationNodeId,
              });
              commitLoadState(operationId, (currentState) => ({
                ...currentState,
                archiveReveal: {
                  status: destination === null ? "missing" : "success",
                  workspacePath: activeWorkspacePath,
                  response,
                },
              }));
            },
          );
        } catch (error) {
          const archiveError = SpecFeatureError.fromCommandError(
            ArchiveSpecCommandError.fromUnknown(error),
          );
          commitLoadState(operationId, (currentState) => ({
            ...currentState,
            archiveSpecError: archiveError,
            archiveFailure: { specId, error: archiveError },
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

  const retryArchiveSpec = useCallback(async (): Promise<boolean> => {
    if (state.archiveFailure === null) {
      return false;
    }

    return await archiveSpec(state.archiveFailure.specId);
  }, [archiveSpec, state.archiveFailure]);

  const refreshArchiveReveal = useCallback(async (): Promise<boolean> => {
    setState((currentState) => ({
      ...currentState,
      archiveFailure: null,
      archiveReveal: null,
      archiveSpecError: null,
    }));
    return await reloadSpecs();
  }, [reloadSpecs]);

  const selectors: SpecsSelectors = useMemo(
    () => buildSpecsSelectors(state),
    [state],
  );
  const actions: SpecsActions = useMemo(
    () => ({
      archiveSpec,
      retryArchiveSpec,
      refreshArchiveReveal,
      reloadSpecs,
      selectSpec,
      selectFileKey,
      reloadDocument,
      resetSelection,
    }),
    [
      archiveSpec,
      refreshArchiveReveal,
      reloadDocument,
      reloadSpecs,
      resetSelection,
      retryArchiveSpec,
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
