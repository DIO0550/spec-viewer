import { useCallback, useEffect, useRef, useState } from "react";

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
type LoadBusyBehavior = "skip" | "join";

/** @returns Spec tree, selection, and Markdown loading state for a workspace. */
export function useSpecs(options: UseSpecsOptions): UseSpecsResult {
  const { onSelectionChange, workspacePath } = options;
  const workspacePathRef = useRef(workspacePath);
  const workspaceGenerationRef = useRef(0);
  const isLoadingRef = useRef(false);
  const loadingOperationIdRef = useRef(0);
  const activeLoadPromiseRef = useRef<Promise<boolean> | null>(null);

  if (workspacePathRef.current !== workspacePath) {
    workspacePathRef.current = workspacePath;
    workspaceGenerationRef.current += 1;
    loadingOperationIdRef.current += 1;
    isLoadingRef.current = false;
    activeLoadPromiseRef.current = null;
  }

  const [specTreeState, setSpecTreeState] =
    useState<SpecTreeState>(initialSpecTreeState);
  const [documentState, setDocumentState] =
    useState<SpecDocumentState>(initialDocumentState);
  const [selectedSpecId, setSelectedSpecId] = useState<string | null>(null);
  const [selectedFileKey, setSelectedFileKey] = useState<SpecFileKey | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [archivingSpecId, setArchivingSpecId] = useState<string | null>(null);
  const [archiveSpecError, setArchiveSpecError] =
    useState<NormalizedCommandError | null>(null);

  const runSpecLoad = useCallback(
    (
      load: () => Promise<boolean>,
      busyBehavior: LoadBusyBehavior = "skip",
    ): Promise<boolean> => {
      if (isLoadingRef.current) {
        return busyBehavior === "join"
          ? (activeLoadPromiseRef.current ?? Promise.resolve(false))
          : Promise.resolve(false);
      }

      const operationId = loadingOperationIdRef.current + 1;
      loadingOperationIdRef.current = operationId;
      isLoadingRef.current = true;
      setIsLoading(true);

      const loadPromise = (async (): Promise<boolean> => {
        try {
          return await load();
        } finally {
          if (loadingOperationIdRef.current === operationId) {
            isLoadingRef.current = false;
            activeLoadPromiseRef.current = null;
            setIsLoading(false);
          }
        }
      })();

      activeLoadPromiseRef.current = loadPromise;
      return loadPromise;
    },
    [],
  );

  const createWorkspaceCommitGuard = useCallback(
    (activeWorkspacePath: string | null): ShouldCommitState => {
      const activeWorkspaceGeneration = workspaceGenerationRef.current;

      return (): boolean =>
        workspacePathRef.current === activeWorkspacePath &&
        workspaceGenerationRef.current === activeWorkspaceGeneration;
    },
    [],
  );

  const resetSelection = useCallback((): void => {
    setSelectedSpecId(null);
    setSelectedFileKey(null);
    setArchivingSpecId(null);
    onSelectionChange?.({
      workspacePath,
      specId: null,
      fileKey: null,
    });
    setDocumentState(SpecDocumentStateFactory.idle(workspacePath));
  }, [onSelectionChange, workspacePath]);

  const loadDocument = useCallback(
    async (
      specId: string,
      fileKey: SpecFileKey,
      activeWorkspacePath: string | null = workspacePath,
      canCommit: ShouldCommitState = createWorkspaceCommitGuard(
        activeWorkspacePath,
      ),
    ): Promise<boolean> => {
      if (!canCommit()) {
        return false;
      }

      if (activeWorkspacePath === null) {
        setDocumentState(
          SpecDocumentStateFactory.idle(activeWorkspacePath, specId, fileKey),
        );
        return true;
      }

      const correlationId = createPerformanceCorrelationId("document-read");
      setDocumentState(
        SpecDocumentStateFactory.loading(
          activeWorkspacePath,
          specId,
          fileKey,
          correlationId,
        ),
      );

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

        setDocumentState(
          SpecDocumentStateFactory.loaded(
            activeWorkspacePath,
            specId,
            fileKey,
            document,
            correlationId,
          ),
        );
        return true;
      } catch (error) {
        endSpan({
          error: true,
        });

        if (!canCommit()) {
          return false;
        }

        setDocumentState(
          SpecDocumentStateFactory.failed(
            activeWorkspacePath,
            specId,
            fileKey,
            normalizeCommandError(error),
            correlationId,
          ),
        );
        return false;
      }
    },
    [createWorkspaceCommitGuard, workspacePath],
  );

  const loadResolvedSelection = useCallback(
    async (
      activeWorkspacePath: string,
      selection: ResolvedSelection,
      canCommit: ShouldCommitState = createWorkspaceCommitGuard(
        activeWorkspacePath,
      ),
    ): Promise<boolean> => {
      if (!canCommit()) {
        return false;
      }

      setSelectedSpecId(selection.spec?.id ?? null);
      setSelectedFileKey(selection.fileKey);
      onSelectionChange?.({
        workspacePath: activeWorkspacePath,
        specId: selection.spec?.id ?? null,
        fileKey: selection.fileKey,
      });

      if (selection.spec === null || selection.fileKey === null) {
        setDocumentState(SpecDocumentStateFactory.idle(activeWorkspacePath));
        return true;
      }

      return await loadDocument(
        selection.spec.id,
        selection.fileKey,
        activeWorkspacePath,
        canCommit,
      );
    },
    [createWorkspaceCommitGuard, loadDocument, onSelectionChange],
  );

  const loadSpecTree = useCallback(
    async (
      preferredSelection: PreferredSelection,
      canCommit: ShouldCommitState = createWorkspaceCommitGuard(workspacePath),
    ): Promise<boolean> => {
      if (!canCommit()) {
        return false;
      }

      if (workspacePath === null) {
        setSpecTreeState(initialSpecTreeState);
        resetSelection();
        return true;
      }

      const activeWorkspacePath = workspacePath;
      setSpecTreeState(SpecTreeStateFactory.loading(activeWorkspacePath));

      try {
        const tree = await specGateway.listSpecs(
          specCommands,
          activeWorkspacePath,
        );

        if (!canCommit()) {
          return false;
        }

        setSpecTreeState(
          SpecTreeStateFactory.loaded(activeWorkspacePath, tree),
        );
        const nextSelection = SpecTreeDomain.resolveSelection(
          tree,
          preferredSelection,
        );

        return await loadResolvedSelection(
          activeWorkspacePath,
          nextSelection,
          canCommit,
        );
      } catch (error) {
        if (!canCommit()) {
          return false;
        }

        setSpecTreeState(
          SpecTreeStateFactory.failed(
            activeWorkspacePath,
            normalizeCommandError(error),
          ),
        );
        resetSelection();
        return false;
      }
    },
    [
      createWorkspaceCommitGuard,
      loadResolvedSelection,
      resetSelection,
      workspacePath,
    ],
  );

  const reloadSpecs = useCallback(
    (): Promise<boolean> =>
      runSpecLoad(
        () =>
          loadSpecTree({
            specId: selectedSpecId,
            fileKey: selectedFileKey,
          }),
        "join",
      ),
    [loadSpecTree, runSpecLoad, selectedFileKey, selectedSpecId],
  );

  useEffect(() => {
    let cancelled = false;
    const activeWorkspaceGeneration = workspaceGenerationRef.current;
    const canCommit = (): boolean =>
      !cancelled &&
      workspacePathRef.current === workspacePath &&
      workspaceGenerationRef.current === activeWorkspaceGeneration;

    resetSelection();

    if (workspacePath === null) {
      setSpecTreeState(initialSpecTreeState);
      setIsLoading(false);
      isLoadingRef.current = false;
      activeLoadPromiseRef.current = null;
      return () => {
        cancelled = true;
      };
    }

    void runSpecLoad(
      () => loadSpecTree({ specId: null, fileKey: null }, canCommit),
      "join",
    );

    return () => {
      cancelled = true;
    };
  }, [loadSpecTree, resetSelection, runSpecLoad, workspacePath]);

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
      await runSpecLoad(async () => {
        const activeWorkspacePath = workspacePath;
        const canCommit = createWorkspaceCommitGuard(activeWorkspacePath);
        const nextSpec =
          tree === null ? null : SpecTreeDomain.findNode(tree, specId);

        if (nextSpec === null || !canCommit()) {
          return false;
        }

        const defaultFileKey = SpecNodeDomain.firstFileKey(nextSpec);
        setSelectedSpecId(specId);
        setSelectedFileKey(defaultFileKey);
        onSelectionChange?.({
          workspacePath: activeWorkspacePath,
          specId,
          fileKey: defaultFileKey,
        });

        if (defaultFileKey === null) {
          setDocumentState(
            SpecDocumentStateFactory.idle(activeWorkspacePath, specId),
          );
          return true;
        }

        return await loadDocument(
          specId,
          defaultFileKey,
          activeWorkspacePath,
          canCommit,
        );
      });
    },
    [
      createWorkspaceCommitGuard,
      loadDocument,
      onSelectionChange,
      runSpecLoad,
      tree,
      workspacePath,
    ],
  );

  const selectFileKey = useCallback(
    async (fileKey: SpecFileKey): Promise<void> => {
      await runSpecLoad(async () => {
        const activeWorkspacePath = workspacePath;
        const canCommit = createWorkspaceCommitGuard(activeWorkspacePath);

        if (selectedSpecId === null || !canCommit()) {
          return false;
        }

        setSelectedFileKey(fileKey);
        onSelectionChange?.({
          workspacePath: activeWorkspacePath,
          specId: selectedSpecId,
          fileKey,
        });

        return await loadDocument(
          selectedSpecId,
          fileKey,
          activeWorkspacePath,
          canCommit,
        );
      });
    },
    [
      createWorkspaceCommitGuard,
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

    return await runSpecLoad(async () => {
      const activeWorkspacePath = workspacePath;
      return await loadDocument(
        selectedSpecId,
        selectedFileKey,
        activeWorkspacePath,
        createWorkspaceCommitGuard(activeWorkspacePath),
      );
    }, "join");
  }, [
    createWorkspaceCommitGuard,
    loadDocument,
    runSpecLoad,
    selectedFileKey,
    selectedSpecId,
    workspacePath,
  ]);

  const archiveSpec = useCallback(
    async (specId: string): Promise<boolean> => {
      return await runSpecLoad(async () => {
        const activeWorkspacePath = workspacePath;
        const canCommit = createWorkspaceCommitGuard(activeWorkspacePath);

        if (activeWorkspacePath === null || !canCommit()) {
          return false;
        }

        setArchivingSpecId(specId);
        setArchiveSpecError(null);

        try {
          await specGateway.archiveSpec(specCommands, {
            workspacePath: activeWorkspacePath,
            specId,
          });

          if (!canCommit()) {
            return false;
          }

          return await loadSpecTree(
            {
              specId: selectedSpecId,
              fileKey: selectedFileKey,
            },
            canCommit,
          );
        } catch (error) {
          if (canCommit()) {
            setArchiveSpecError(normalizeCommandError(error));
          }
          return false;
        } finally {
          if (canCommit()) {
            setArchivingSpecId(null);
          }
        }
      });
    },
    [
      createWorkspaceCommitGuard,
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
