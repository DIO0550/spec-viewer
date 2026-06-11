import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SpecCollection } from "@/features/specs/domain/specCollection";
import type { SpecDocumentState } from "@/features/specs/domain/specDocumentState";
import { SpecTreeState } from "@/features/specs/domain/specTreeState";
import type {
  ReadSpecFileRequest,
  SpecDocument,
  SpecFile,
  SpecFileKey,
  SpecNode,
  SpecTree,
} from "@/features/specs/types/spec";
import {
  archiveSpec as defaultArchiveSpec,
  listSpecs as defaultListSpecs,
  readSpecFile as defaultReadSpecFile,
  normalizeCommandError,
} from "@/shared/api/tauri";
import type { NormalizedCommandError } from "@/shared/types/ipc";
import { useSpecDocumentLoader } from "./useSpecDocumentLoader";

export type { SpecDocumentState } from "@/features/specs/domain/specDocumentState";
export type { SpecTreeState } from "@/features/specs/domain/specTreeState";

export type ArchiveSpecCommand = (
  request: Readonly<{ workspacePath: string; specId: string }>,
) => Promise<Readonly<{ archivedSpecId: string; archivePath: string }>>;

export type ListSpecsCommand = (workspacePath: string) => Promise<SpecTree>;

export type ReadSpecFileCommand = (
  request: ReadSpecFileRequest,
) => Promise<SpecDocument>;

export type ReloadSpecsOptions = Readonly<{
  preserveSelection?: boolean;
}>;

export type UseSpecsOptions = Readonly<{
  workspacePath: string | null;
  listSpecs?: ListSpecsCommand;
  readSpecFile?: ReadSpecFileCommand;
  archiveSpec?: ArchiveSpecCommand;
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
  /** @param specId - Spec to move into the workspace archive */
  archiveSpec: (specId: string) => Promise<boolean>;
  /** @param options - Whether to preserve the current selection */
  reloadSpecs: (options?: ReloadSpecsOptions) => Promise<boolean>;
  /** @param specId - Spec to select, or null to clear the selection */
  selectSpec: (specId: string | null) => Promise<void>;
  /** @param fileKey - File to open inside the selected spec, or null */
  selectFileKey: (fileKey: SpecFileKey | null) => Promise<void>;
  /** Reloads the currently selected document. */
  reloadDocument: () => Promise<boolean>;
  /** Clears the spec and file selection. */
  resetSelection: () => void;
}>;

/**
 * @param options - Active workspace path and injectable spec commands.
 * @returns Spec tree, selection, and Markdown loading state for a workspace.
 */
export function useSpecs(options: UseSpecsOptions): UseSpecsResult {
  const { workspacePath } = options;
  const listSpecs = options.listSpecs ?? defaultListSpecs;
  const readSpecFile = options.readSpecFile ?? defaultReadSpecFile;
  const archiveSpecCommand = options.archiveSpec ?? defaultArchiveSpec;
  const specTreeRequestIdRef = useRef(0);
  const [specTreeState, setSpecTreeState] = useState<SpecTreeState>(
    SpecTreeState.idle,
  );
  const { documentState, setIdleDocumentState, loadDocument } =
    useSpecDocumentLoader({ workspacePath, readSpecFile });
  const [selectedSpecId, setSelectedSpecId] = useState<string | null>(null);
  const [selectedFileKey, setSelectedFileKey] = useState<SpecFileKey | null>(
    null,
  );
  const [archivingSpecId, setArchivingSpecId] = useState<string | null>(null);
  const [archiveSpecError, setArchiveSpecError] =
    useState<NormalizedCommandError | null>(null);
  const selectedSpecIdRef = useRef<string | null>(null);
  const selectedFileKeyRef = useRef<SpecFileKey | null>(null);

  selectedSpecIdRef.current = selectedSpecId;
  selectedFileKeyRef.current = selectedFileKey;

  const resetSelection = useCallback((): void => {
    setSelectedSpecId(null);
    setSelectedFileKey(null);
    setIdleDocumentState(workspacePath);
  }, [setIdleDocumentState, workspacePath]);

  const reloadSpecs = useCallback(
    async (reloadOptions: ReloadSpecsOptions = {}): Promise<boolean> => {
      if (workspacePath === null) {
        specTreeRequestIdRef.current += 1;
        setSpecTreeState(SpecTreeState.idle());
        resetSelection();
        return true;
      }

      const activeWorkspacePath = workspacePath;
      const requestId = specTreeRequestIdRef.current + 1;
      specTreeRequestIdRef.current = requestId;
      setSpecTreeState(SpecTreeState.loading(activeWorkspacePath));

      try {
        const tree = await listSpecs(activeWorkspacePath);

        if (specTreeRequestIdRef.current !== requestId) {
          return false;
        }

        setSpecTreeState(
          SpecTreeState.fromTree({ workspacePath: activeWorkspacePath, tree }),
        );
        const nextSelection = SpecCollection.resolveReloadedSelection({
          tree,
          preserveSelection: reloadOptions.preserveSelection === true,
          selectedSpecId: selectedSpecIdRef.current,
          selectedFileKey: selectedFileKeyRef.current,
        });

        setSelectedSpecId(nextSelection.spec?.id ?? null);
        setSelectedFileKey(nextSelection.fileKey);

        if (nextSelection.spec === null || nextSelection.fileKey === null) {
          setIdleDocumentState(activeWorkspacePath);
          return true;
        }

        return await loadDocument(nextSelection.spec.id, nextSelection.fileKey);
      } catch (error) {
        if (specTreeRequestIdRef.current !== requestId) {
          return false;
        }

        setSpecTreeState(
          SpecTreeState.failed({
            workspacePath: activeWorkspacePath,
            error: normalizeCommandError(error),
          }),
        );
        resetSelection();
        return false;
      }
    },
    [
      listSpecs,
      loadDocument,
      resetSelection,
      setIdleDocumentState,
      workspacePath,
    ],
  );

  useEffect(() => {
    resetSelection();

    if (workspacePath === null) {
      specTreeRequestIdRef.current += 1;
      setSpecTreeState(SpecTreeState.idle());
      return;
    }

    void reloadSpecs();
  }, [reloadSpecs, resetSelection, workspacePath]);

  const tree = specTreeState.tree;
  const selectedSpec = useMemo(
    (): SpecNode | null =>
      tree === null || selectedSpecId === null
        ? null
        : SpecCollection.findNode(tree.specs, selectedSpecId),
    [selectedSpecId, tree],
  );

  const selectedFile = useMemo(
    (): SpecFile | null =>
      SpecCollection.findFile(selectedSpec, selectedFileKey),
    [selectedFileKey, selectedSpec],
  );

  const selectSpec = useCallback(
    async (specId: string | null): Promise<void> => {
      setSelectedSpecId(specId);

      const nextSpec =
        tree === null || specId === null
          ? null
          : SpecCollection.findNode(tree.specs, specId);
      const defaultFileKey = nextSpec?.files[0]?.key ?? null;
      setSelectedFileKey(defaultFileKey);

      if (specId === null || defaultFileKey === null) {
        setIdleDocumentState(workspacePath, specId);
        return;
      }

      await loadDocument(specId, defaultFileKey);
    },
    [loadDocument, setIdleDocumentState, tree, workspacePath],
  );

  const selectFileKey = useCallback(
    async (fileKey: SpecFileKey | null): Promise<void> => {
      setSelectedFileKey(fileKey);

      if (selectedSpecId === null || fileKey === null) {
        setIdleDocumentState(workspacePath, selectedSpecId, fileKey);
        return;
      }

      await loadDocument(selectedSpecId, fileKey);
    },
    [loadDocument, selectedSpecId, setIdleDocumentState, workspacePath],
  );

  const reloadDocument = useCallback(async (): Promise<boolean> => {
    if (selectedSpecId === null || selectedFileKey === null) {
      return true;
    }

    return await loadDocument(selectedSpecId, selectedFileKey);
  }, [loadDocument, selectedFileKey, selectedSpecId]);

  const archiveSpec = useCallback(
    async (specId: string): Promise<boolean> => {
      if (workspacePath === null) {
        return false;
      }

      setArchivingSpecId(specId);
      setArchiveSpecError(null);

      try {
        await archiveSpecCommand({ workspacePath, specId });
        return await reloadSpecs({ preserveSelection: true });
      } catch (error) {
        setArchiveSpecError(normalizeCommandError(error));
        return false;
      } finally {
        setArchivingSpecId(null);
      }
    },
    [archiveSpecCommand, reloadSpecs, workspacePath],
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
