import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { SpecDocumentState as SpecDocumentStateFactory } from "@/features/specs/domain/specDocumentState";
import type { SpecDocumentState } from "@/features/specs/domain/specDocumentState";
import { SpecNode as SpecNodeDomain } from "@/features/specs/domain/specNode";
import { SpecTree as SpecTreeDomain } from "@/features/specs/domain/specTree";
import { SpecTreeState as SpecTreeStateFactory } from "@/features/specs/domain/specTreeState";
import type { SpecTreeState } from "@/features/specs/domain/specTreeState";
import * as specGateway from "@/features/specs/infra/specGateway";
import { normalizeCommandError, specCommands as defaultSpecCommands } from "@/shared/api/tauri";
import type { SpecCommands } from "@/shared/api/tauri";
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

export type ArchiveSpecCommand = SpecCommands["archiveSpec"];
export type ListSpecsCommand = SpecCommands["listSpecs"];
export type ReadSpecFileCommand = SpecCommands["readSpecFile"];

export type ReloadSpecsOptions = Readonly<{
  preserveSelection?: boolean;
}>;

export type SpecSelectionChange = Readonly<{
  workspacePath: string | null;
  specId: string | null;
  fileKey: SpecFileKey | null;
}>;

export type UseSpecsOptions = Readonly<{
  workspacePath: string | null;
  commands?: SpecCommands;
  listSpecs?: ListSpecsCommand;
  readSpecFile?: ReadSpecFileCommand;
  archiveSpec?: ArchiveSpecCommand;
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
  reloadSpecs: (options?: ReloadSpecsOptions) => Promise<boolean>;
  selectSpec: (specId: string) => Promise<void>;
  selectFileKey: (fileKey: SpecFileKey) => Promise<void>;
  reloadDocument: () => Promise<boolean>;
  resetSelection: () => void;
}>;

const initialSpecTreeState: SpecTreeState = SpecTreeStateFactory.idle();
const initialDocumentState: SpecDocumentState = SpecDocumentStateFactory.idle(null);

/** @returns Spec tree, selection, and Markdown loading state for a workspace. */
export function useSpecs(options: UseSpecsOptions): UseSpecsResult {
  const { onSelectionChange, workspacePath } = options;
  const resolvedSpecCommands = useMemo<SpecCommands>(() => {
    const commands = options.commands ?? defaultSpecCommands;

    return {
      listSpecs: options.listSpecs ?? commands.listSpecs,
      readSpecFile: options.readSpecFile ?? commands.readSpecFile,
      archiveSpec: options.archiveSpec ?? commands.archiveSpec,
    };
  }, [options.archiveSpec, options.commands, options.listSpecs, options.readSpecFile]);
  const specTreeRequestIdRef = useRef(0);
  const documentRequestIdRef = useRef(0);
  const [specTreeState, setSpecTreeState] =
    useState<SpecTreeState>(initialSpecTreeState);
  const [documentState, setDocumentState] =
    useState<SpecDocumentState>(initialDocumentState);
  const [selectedSpecId, setSelectedSpecId] = useState<string | null>(null);
  const [selectedFileKey, setSelectedFileKey] = useState<SpecFileKey | null>(
    null,
  );
  const [archivingSpecId, setArchivingSpecId] = useState<string | null>(null);
  const archivingSpecIdRef = useRef<string | null>(null);
  const [archiveSpecError, setArchiveSpecError] =
    useState<NormalizedCommandError | null>(null);
  const selectedSpecIdRef = useRef<string | null>(null);
  const selectedFileKeyRef = useRef<SpecFileKey | null>(null);

  selectedSpecIdRef.current = selectedSpecId;
  selectedFileKeyRef.current = selectedFileKey;

  const resetSelection = useCallback((): void => {
    documentRequestIdRef.current += 1;
    setSelectedSpecId(null);
    setSelectedFileKey(null);
    onSelectionChange?.({
      workspacePath,
      specId: null,
      fileKey: null,
    });
    setDocumentState(SpecDocumentStateFactory.idle(workspacePath));
  }, [onSelectionChange, workspacePath]);

  const loadDocument = useCallback(
    async (specId: string, fileKey: SpecFileKey): Promise<boolean> => {
      if (workspacePath === null) {
        documentRequestIdRef.current += 1;
        setDocumentState(
          SpecDocumentStateFactory.idle(workspacePath, specId, fileKey),
        );
        return true;
      }

      const activeWorkspacePath = workspacePath;
      const requestId = documentRequestIdRef.current + 1;
      const correlationId = createPerformanceCorrelationId("document-read");
      documentRequestIdRef.current = requestId;
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
          resolvedSpecCommands,
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

        if (documentRequestIdRef.current !== requestId) {
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

        if (documentRequestIdRef.current !== requestId) {
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
    [resolvedSpecCommands, workspacePath],
  );

  const reloadSpecs = useCallback(
    async (reloadOptions: ReloadSpecsOptions = {}): Promise<boolean> => {
      if (workspacePath === null) {
        specTreeRequestIdRef.current += 1;
        setSpecTreeState(initialSpecTreeState);
        resetSelection();
        return true;
      }

      const activeWorkspacePath = workspacePath;
      const requestId = specTreeRequestIdRef.current + 1;
      specTreeRequestIdRef.current = requestId;
      setSpecTreeState(SpecTreeStateFactory.loading(activeWorkspacePath));

      try {
        const tree = await specGateway.listSpecs(
          resolvedSpecCommands,
          activeWorkspacePath,
        );

        if (specTreeRequestIdRef.current !== requestId) {
          return false;
        }

        setSpecTreeState(SpecTreeStateFactory.loaded(activeWorkspacePath, tree));
        const nextSelection = SpecTreeDomain.resolveSelection(tree, {
          specId:
            reloadOptions.preserveSelection === true
              ? selectedSpecIdRef.current
              : null,
          fileKey:
            reloadOptions.preserveSelection === true
              ? selectedFileKeyRef.current
              : null,
        });

        setSelectedSpecId(nextSelection.spec?.id ?? null);
        setSelectedFileKey(nextSelection.fileKey);
        onSelectionChange?.({
          workspacePath: activeWorkspacePath,
          specId: nextSelection.spec?.id ?? null,
          fileKey: nextSelection.fileKey,
        });

        if (nextSelection.spec === null || nextSelection.fileKey === null) {
          documentRequestIdRef.current += 1;
          setDocumentState(SpecDocumentStateFactory.idle(activeWorkspacePath));
          return true;
        }

        return await loadDocument(nextSelection.spec.id, nextSelection.fileKey);
      } catch (error) {
        if (specTreeRequestIdRef.current !== requestId) {
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
      loadDocument,
      onSelectionChange,
      resetSelection,
      resolvedSpecCommands,
      workspacePath,
    ],
  );

  useEffect(() => {
    resetSelection();

    if (workspacePath === null) {
      specTreeRequestIdRef.current += 1;
      setSpecTreeState(initialSpecTreeState);
      return;
    }

    void reloadSpecs();
  }, [reloadSpecs, resetSelection, workspacePath]);

  const tree = specTreeState.tree;
  const selectedSpec = useMemo((): SpecNode | null => {
    if (tree === null || selectedSpecId === null) {
      return null;
    }

    return SpecTreeDomain.findNode(tree, selectedSpecId);
  }, [selectedSpecId, tree]);

  const selectedFile = useMemo(
    (): SpecFile | null =>
      SpecNodeDomain.selectedFile(selectedSpec, selectedFileKey),
    [selectedFileKey, selectedSpec],
  );

  const selectSpec = useCallback(
    async (specId: string): Promise<void> => {
      const nextSpec = tree === null ? null : SpecTreeDomain.findNode(tree, specId);
      const defaultFileKey = SpecNodeDomain.firstFileKey(nextSpec);

      if (nextSpec === null || defaultFileKey === null) {
        return;
      }

      setSelectedSpecId(specId);
      setSelectedFileKey(defaultFileKey);
      onSelectionChange?.({
        workspacePath,
        specId,
        fileKey: defaultFileKey,
      });

      await loadDocument(specId, defaultFileKey);
    },
    [loadDocument, onSelectionChange, tree, workspacePath],
  );

  const selectFileKey = useCallback(
    async (fileKey: SpecFileKey): Promise<void> => {
      if (selectedSpecId === null) {
        return;
      }

      setSelectedFileKey(fileKey);
      onSelectionChange?.({
        workspacePath,
        specId: selectedSpecId,
        fileKey,
      });

      await loadDocument(selectedSpecId, fileKey);
    },
    [loadDocument, onSelectionChange, selectedSpecId, workspacePath],
  );

  const reloadDocument = useCallback(async (): Promise<boolean> => {
    if (selectedSpecId === null || selectedFileKey === null) {
      return true;
    }

    return await loadDocument(selectedSpecId, selectedFileKey);
  }, [loadDocument, selectedFileKey, selectedSpecId]);

  const archiveSpec = useCallback(
    async (specId: string): Promise<boolean> => {
      const activeWorkspacePath = workspacePath;

      if (activeWorkspacePath === null || archivingSpecIdRef.current !== null) {
        return false;
      }

      archivingSpecIdRef.current = specId;
      setArchivingSpecId(specId);
      setArchiveSpecError(null);

      try {
        await specGateway.archiveSpec(resolvedSpecCommands, {
          workspacePath: activeWorkspacePath,
          specId,
        });
        return await reloadSpecs({ preserveSelection: true });
      } catch (error) {
        setArchiveSpecError(normalizeCommandError(error));
        return false;
      } finally {
        archivingSpecIdRef.current = null;
        setArchivingSpecId(null);
      }
    },
    [reloadSpecs, resolvedSpecCommands, workspacePath],
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
