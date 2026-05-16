import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  archiveSpec as defaultArchiveSpec,
  listSpecs as defaultListSpecs,
  normalizeCommandError,
  readSpecFile as defaultReadSpecFile,
} from "../lib/tauri";
import {
  createPerformanceCorrelationId,
  startPerformanceSpan,
} from "../lib/performance";
import type { NormalizedCommandError } from "../types/ipc";
import type {
  ReadSpecFileRequest,
  SpecDocument,
  SpecFile,
  SpecFileKey,
  SpecNode,
  SpecTree,
} from "../types/spec";

export type ArchiveSpecCommand = (
  request: Readonly<{ workspacePath: string; specId: string }>,
) => Promise<Readonly<{ archivedSpecId: string; archivePath: string }>>;

export type SpecTreeState =
  | Readonly<{
      status: "idle";
      workspacePath: null;
      tree: null;
      error: null;
    }>
  | Readonly<{
      status: "loading";
      workspacePath: string;
      tree: null;
      error: null;
    }>
  | Readonly<{
      status: "ready";
      workspacePath: string;
      tree: SpecTree;
      error: null;
    }>
  | Readonly<{
      status: "empty";
      workspacePath: string;
      tree: SpecTree;
      error: null;
    }>
  | Readonly<{
      status: "error";
      workspacePath: string;
      tree: null;
      error: NormalizedCommandError;
    }>;

export type SpecDocumentState =
  | Readonly<{
      status: "idle";
      workspacePath: string | null;
      specId: string | null;
      fileKey: SpecFileKey | null;
      correlationId?: string;
      document: null;
      error: null;
    }>
  | Readonly<{
      status: "loading";
      workspacePath: string;
      specId: string;
      fileKey: SpecFileKey;
      correlationId?: string;
      document: null;
      error: null;
    }>
  | Readonly<{
      status: "ready";
      workspacePath: string;
      specId: string;
      fileKey: SpecFileKey;
      correlationId?: string;
      document: SpecDocument;
      error: null;
    }>
  | Readonly<{
      status: "missing";
      workspacePath: string;
      specId: string;
      fileKey: SpecFileKey;
      correlationId?: string;
      document: SpecDocument;
      error: null;
    }>
  | Readonly<{
      status: "error";
      workspacePath: string;
      specId: string;
      fileKey: SpecFileKey;
      correlationId?: string;
      document: null;
      error: NormalizedCommandError;
    }>;

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
  archiveSpec: (specId: string) => Promise<boolean>;
  reloadSpecs: (options?: ReloadSpecsOptions) => Promise<boolean>;
  selectSpec: (specId: string | null) => Promise<void>;
  selectFileKey: (fileKey: SpecFileKey | null) => Promise<void>;
  reloadDocument: () => Promise<boolean>;
  resetSelection: () => void;
}>;

const initialSpecTreeState: SpecTreeState = {
  status: "idle",
  workspacePath: null,
  tree: null,
  error: null,
};

const initialDocumentState: SpecDocumentState = {
  status: "idle",
  workspacePath: null,
  specId: null,
  fileKey: null,
  document: null,
  error: null,
};

/** @returns Spec tree, selection, and Markdown loading state for a workspace. */
export function useSpecs(options: UseSpecsOptions): UseSpecsResult {
  const { workspacePath } = options;
  const listSpecs = options.listSpecs ?? defaultListSpecs;
  const readSpecFile = options.readSpecFile ?? defaultReadSpecFile;
  const archiveSpecCommand = options.archiveSpec ?? defaultArchiveSpec;
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
    setDocumentState(createIdleDocumentState(workspacePath));
  }, [workspacePath]);

  const loadDocument = useCallback(
    async (specId: string, fileKey: SpecFileKey): Promise<boolean> => {
      if (workspacePath === null) {
        documentRequestIdRef.current += 1;
        setDocumentState(
          createIdleDocumentState(workspacePath, specId, fileKey),
        );
        return true;
      }

      const activeWorkspacePath = workspacePath;
      const requestId = documentRequestIdRef.current + 1;
      const correlationId = createPerformanceCorrelationId("document-read");
      documentRequestIdRef.current = requestId;
      setDocumentState({
        status: "loading",
        workspacePath: activeWorkspacePath,
        specId,
        fileKey,
        correlationId,
        document: null,
        error: null,
      });

      const endSpan = startPerformanceSpan(correlationId, "document.read", {
        specId,
        fileKey,
      });

      try {
        const document = await readSpecFile({
          workspacePath: activeWorkspacePath,
          specId,
          fileKey,
          correlationId,
        });
        endSpan({
          bytes: document.contents?.length ?? 0,
          blockCount: document.blocks.length,
          missing: document.missing,
        });

        if (documentRequestIdRef.current !== requestId) {
          return false;
        }

        setDocumentState({
          status: document.missing ? "missing" : "ready",
          workspacePath: activeWorkspacePath,
          specId,
          fileKey,
          correlationId,
          document,
          error: null,
        });
        return true;
      } catch (error) {
        endSpan({
          error: true,
        });

        if (documentRequestIdRef.current !== requestId) {
          return false;
        }

        setDocumentState({
          status: "error",
          workspacePath: activeWorkspacePath,
          specId,
          fileKey,
          correlationId,
          document: null,
          error: normalizeCommandError(error),
        });
        return false;
      }
    },
    [readSpecFile, workspacePath],
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
      setSpecTreeState({
        status: "loading",
        workspacePath: activeWorkspacePath,
        tree: null,
        error: null,
      });

      try {
        const tree = await listSpecs(activeWorkspacePath);

        if (specTreeRequestIdRef.current !== requestId) {
          return false;
        }

        setSpecTreeState({
          status: tree.specs.length === 0 ? "empty" : "ready",
          workspacePath: activeWorkspacePath,
          tree,
          error: null,
        });
        const nextSelection = resolveReloadedSelection({
          tree,
          preserveSelection: reloadOptions.preserveSelection === true,
          selectedSpecId: selectedSpecIdRef.current,
          selectedFileKey: selectedFileKeyRef.current,
        });

        setSelectedSpecId(nextSelection.spec?.id ?? null);
        setSelectedFileKey(nextSelection.fileKey);

        if (nextSelection.spec === null || nextSelection.fileKey === null) {
          documentRequestIdRef.current += 1;
          setDocumentState(createIdleDocumentState(activeWorkspacePath));
          return true;
        }

        return await loadDocument(nextSelection.spec.id, nextSelection.fileKey);
      } catch (error) {
        if (specTreeRequestIdRef.current !== requestId) {
          return false;
        }

        setSpecTreeState({
          status: "error",
          workspacePath: activeWorkspacePath,
          tree: null,
          error: normalizeCommandError(error),
        });
        resetSelection();
        return false;
      }
    },
    [listSpecs, loadDocument, resetSelection, workspacePath],
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

    return findSpecNode(tree.specs, selectedSpecId);
  }, [selectedSpecId, tree]);

  const selectedFile = useMemo((): SpecFile | null => {
    if (selectedSpec === null || selectedFileKey === null) {
      return null;
    }

    return (
      selectedSpec.files.find((file) => file.key === selectedFileKey) ?? null
    );
  }, [selectedFileKey, selectedSpec]);

  const selectSpec = useCallback(
    async (specId: string | null): Promise<void> => {
      setSelectedSpecId(specId);

      const nextSpec =
        tree === null || specId === null
          ? null
          : findSpecNode(tree.specs, specId);
      const defaultFileKey = nextSpec?.files[0]?.key ?? null;
      setSelectedFileKey(defaultFileKey);

      if (specId === null || defaultFileKey === null) {
        documentRequestIdRef.current += 1;
        setDocumentState(createIdleDocumentState(workspacePath, specId));
        return;
      }

      await loadDocument(specId, defaultFileKey);
    },
    [loadDocument, tree, workspacePath],
  );

  const selectFileKey = useCallback(
    async (fileKey: SpecFileKey | null): Promise<void> => {
      setSelectedFileKey(fileKey);

      if (selectedSpecId === null || fileKey === null) {
        documentRequestIdRef.current += 1;
        setDocumentState(
          createIdleDocumentState(workspacePath, selectedSpecId, fileKey),
        );
        return;
      }

      await loadDocument(selectedSpecId, fileKey);
    },
    [loadDocument, selectedSpecId, workspacePath],
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

/** @returns Matching spec node from a nested tree, or null when absent. */
function findSpecNode(nodes: readonly SpecNode[], id: string): SpecNode | null {
  for (const node of nodes) {
    if (node.id === id) {
      return node;
    }

    const child = findSpecNode(node.children, id);

    if (child !== null) {
      return child;
    }
  }

  return null;
}

/** @returns First spec node that can open a file, falling back to the first node. */
function findDefaultSpecNode(nodes: readonly SpecNode[]): SpecNode | null {
  const firstNode = nodes[0] ?? null;

  for (const node of nodes) {
    if (node.files.length > 0) {
      return node;
    }

    const child = findDefaultSpecNode(node.children);

    if (child !== null && child.files.length > 0) {
      return child;
    }
  }

  return firstNode;
}

type ResolveReloadedSelectionOptions = Readonly<{
  tree: SpecTree;
  preserveSelection: boolean;
  selectedSpecId: string | null;
  selectedFileKey: SpecFileKey | null;
}>;

type ReloadedSelection = Readonly<{
  spec: SpecNode | null;
  fileKey: SpecFileKey | null;
}>;

/** @returns Selection to use after refreshing the spec tree. */
function resolveReloadedSelection({
  tree,
  preserveSelection,
  selectedSpecId,
  selectedFileKey,
}: ResolveReloadedSelectionOptions): ReloadedSelection {
  if (preserveSelection && selectedSpecId !== null) {
    const preservedSpec = findSpecNode(tree.specs, selectedSpecId);

    if (preservedSpec !== null) {
      const preservedFileKey = findPreservedFileKey(
        preservedSpec,
        selectedFileKey,
      );

      return {
        spec: preservedSpec,
        fileKey: preservedFileKey,
      };
    }
  }

  const defaultSpec = findDefaultSpecNode(tree.specs);

  return {
    spec: defaultSpec,
    fileKey: defaultSpec?.files[0]?.key ?? null,
  };
}

/** @returns Current file key when still present, otherwise the first file key. */
function findPreservedFileKey(
  spec: SpecNode,
  selectedFileKey: SpecFileKey | null,
): SpecFileKey | null {
  if (
    selectedFileKey !== null &&
    spec.files.some((file) => file.key === selectedFileKey)
  ) {
    return selectedFileKey;
  }

  return spec.files[0]?.key ?? null;
}

/** @returns Idle Markdown document state for the current selection context. */
function createIdleDocumentState(
  workspacePath: string | null,
  specId: string | null = null,
  fileKey: SpecFileKey | null = null,
): SpecDocumentState {
  return {
    status: "idle",
    workspacePath,
    specId,
    fileKey,
    document: null,
    error: null,
  };
}
