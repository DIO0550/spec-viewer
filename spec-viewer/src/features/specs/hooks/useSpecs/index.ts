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

/** @returns Spec tree, selection, and Markdown loading state for a workspace. */
export function useSpecs(options: UseSpecsOptions): UseSpecsResult {
  const { onSelectionChange, workspacePath } = options;
  const workspacePathRef = useRef(workspacePath);
  workspacePathRef.current = workspacePath;
  const [specTreeState, setSpecTreeState] =
    useState<SpecTreeState>(initialSpecTreeState);
  const [documentState, setDocumentState] =
    useState<SpecDocumentState>(initialDocumentState);
  const [selectedSpecId, setSelectedSpecId] = useState<string | null>(null);
  const [selectedFileKey, setSelectedFileKey] = useState<SpecFileKey | null>(
    null,
  );
  const [archivingSpecId, setArchivingSpecId] = useState<string | null>(null);
  const [archiveSpecError, setArchiveSpecError] =
    useState<NormalizedCommandError | null>(null);

  const createWorkspaceCommitGuard = useCallback(
    (activeWorkspacePath: string | null): ShouldCommitState =>
      (): boolean =>
        workspacePathRef.current === activeWorkspacePath,
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
      loadSpecTree({
        specId: selectedSpecId,
        fileKey: selectedFileKey,
      }),
    [loadSpecTree, selectedFileKey, selectedSpecId],
  );

  useEffect(() => {
    let cancelled = false;
    const canCommit = (): boolean =>
      !cancelled && workspacePathRef.current === workspacePath;

    resetSelection();

    if (workspacePath === null) {
      setSpecTreeState(initialSpecTreeState);
      return () => {
        cancelled = true;
      };
    }

    void loadSpecTree({ specId: null, fileKey: null }, canCommit);

    return () => {
      cancelled = true;
    };
  }, [loadSpecTree, resetSelection, workspacePath]);

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
      const activeWorkspacePath = workspacePath;
      const canCommit = createWorkspaceCommitGuard(activeWorkspacePath);
      const nextSpec =
        tree === null ? null : SpecTreeDomain.findNode(tree, specId);

      if (nextSpec === null || !canCommit()) {
        return;
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
        return;
      }

      await loadDocument(
        specId,
        defaultFileKey,
        activeWorkspacePath,
        canCommit,
      );
    },
    [
      createWorkspaceCommitGuard,
      loadDocument,
      onSelectionChange,
      tree,
      workspacePath,
    ],
  );

  const selectFileKey = useCallback(
    async (fileKey: SpecFileKey): Promise<void> => {
      const activeWorkspacePath = workspacePath;
      const canCommit = createWorkspaceCommitGuard(activeWorkspacePath);

      if (selectedSpecId === null || !canCommit()) {
        return;
      }

      setSelectedFileKey(fileKey);
      onSelectionChange?.({
        workspacePath: activeWorkspacePath,
        specId: selectedSpecId,
        fileKey,
      });

      await loadDocument(
        selectedSpecId,
        fileKey,
        activeWorkspacePath,
        canCommit,
      );
    },
    [
      createWorkspaceCommitGuard,
      loadDocument,
      onSelectionChange,
      selectedSpecId,
      workspacePath,
    ],
  );

  const reloadDocument = useCallback(async (): Promise<boolean> => {
    if (selectedSpecId === null || selectedFileKey === null) {
      return true;
    }

    const activeWorkspacePath = workspacePath;
    return await loadDocument(
      selectedSpecId,
      selectedFileKey,
      activeWorkspacePath,
      createWorkspaceCommitGuard(activeWorkspacePath),
    );
  }, [
    createWorkspaceCommitGuard,
    loadDocument,
    selectedFileKey,
    selectedSpecId,
    workspacePath,
  ]);

  const archiveSpec = useCallback(
    async (specId: string): Promise<boolean> => {
      const activeWorkspacePath = workspacePath;
      const canCommit = createWorkspaceCommitGuard(activeWorkspacePath);

      if (
        activeWorkspacePath === null ||
        archivingSpecId !== null ||
        !canCommit()
      ) {
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

        return await reloadSpecs();
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
    },
    [archivingSpecId, createWorkspaceCommitGuard, reloadSpecs, workspacePath],
  );

  return {
    specTreeState,
    documentState,
    selectedSpecId,
    selectedSpec,
    selectedFileKey,
    selectedFile,
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
