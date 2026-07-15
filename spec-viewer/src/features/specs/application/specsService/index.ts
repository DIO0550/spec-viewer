import type { SpecGateway } from "@/features/specs/application/ports/specGateway";
import type {
  SpecOperationRegistry,
  SpecOperationToken,
} from "@/features/specs/application/specOperation";
import type {
  SpecSelectionState,
  SpecsStateEvent,
} from "@/features/specs/application/specsState";
import { archiveSpec as runArchiveSpec } from "@/features/specs/application/useCases/archiveSpec";
import { listSpecs } from "@/features/specs/application/useCases/listSpecs";
import { readSpecDocument } from "@/features/specs/application/useCases/readSpecDocument";
import {
  selectSpecFile,
  type ResolvedSpecFileSelection,
} from "@/features/specs/application/useCases/selectSpecFile";
import type { SpecDocument } from "@/features/specs/domain/specDocument";
import type { SpecTree } from "@/features/specs/domain/specTree";
import type { SpecFileKey } from "@/shared/domain/specFileKey";
import type { SpecId } from "@/shared/domain/specId";
import type { WorkspacePath } from "@/shared/domain/workspacePath";
import {
  createPerformanceCorrelationId,
  startPerformanceSpan,
  type PerformanceMetadata,
} from "@/shared/lib/performance";

export type SpecSelectionChange = Readonly<{
  workspacePath: WorkspacePath | null;
  specId: SpecId | null;
  fileKey: SpecFileKey | null;
}>;

type PreferredSelection = SpecSelectionState;

type ReloadSpecsInput = Readonly<{
  workspacePath: WorkspacePath;
  preferredSelection: PreferredSelection;
}>;

type SelectSpecInput = Readonly<{
  workspacePath: WorkspacePath;
  tree: SpecTree;
  specId: SpecId;
}>;

type SelectFileInput = Readonly<{
  workspacePath: WorkspacePath;
  tree: SpecTree;
  specId: SpecId;
  fileKey: SpecFileKey;
}>;

type ReloadDocumentInput = Readonly<{
  workspacePath: WorkspacePath;
  specId: SpecId;
  fileKey: SpecFileKey;
}>;

type ArchiveSpecServiceInput = Readonly<{
  workspacePath: WorkspacePath;
  specId: SpecId;
  preferredSelection: PreferredSelection;
}>;

export type SpecsApplicationService = Readonly<{
  /** Replaces the active workspace and loads its default selection. */
  synchronizeWorkspace: (
    workspacePath: WorkspacePath | null,
  ) => Promise<boolean>;
  /** Invalidates work owned by the current hook effect. */
  cancelWorkspace: () => void;
  /** Reloads the tree while retaining a preferred selection when possible. */
  reloadSpecs: (input: ReloadSpecsInput) => Promise<boolean>;
  /** Selects a spec and reads its first configured file. */
  selectSpec: (input: SelectSpecInput) => Promise<boolean>;
  /** Selects and reads one logical spec file. */
  selectFile: (input: SelectFileInput) => Promise<boolean>;
  /** Reloads the current document selection. */
  reloadDocument: (input: ReloadDocumentInput) => Promise<boolean>;
  /** Archives a spec, reloads the tree, and resolves the next selection. */
  archiveSpec: (input: ArchiveSpecServiceInput) => Promise<boolean>;
  /** Invalidates in-flight work and clears only the current selection. */
  resetSelection: (workspacePath: WorkspacePath | null) => void;
}>;

export type SpecsApplicationServiceDependencies = Readonly<{
  gateway: SpecGateway;
  operationRegistry: SpecOperationRegistry;
  dispatch: (event: SpecsStateEvent) => void;
  onSelectionChange?: (selection: SpecSelectionChange) => void;
}>;

/**
 * @param dependencies - Injected gateway, token registry, and presentation adapters.
 * @returns React-free specs workflow orchestration.
 */
export function createSpecsApplicationService(
  dependencies: SpecsApplicationServiceDependencies,
): SpecsApplicationService {
  const { dispatch, gateway, onSelectionChange, operationRegistry } =
    dependencies;

  /**
   * @param token - Active operation token.
   * @param workspacePath - Active workspace identity.
   * @param selection - Resolved domain selection.
   * @returns Whether the selection and document load completed.
   */
  const loadSelection = async (
    token: SpecOperationToken,
    workspacePath: WorkspacePath,
    selection: ResolvedSpecFileSelection,
  ): Promise<boolean> => {
    if (!operationRegistry.isCurrent(token)) {
      return false;
    }

    const nextSelection = {
      specId: selection.spec?.id ?? null,
      fileKey: selection.fileKey,
    };
    dispatch({ type: "selectionChanged", selection: nextSelection, token });
    publishSelection(token, workspacePath, nextSelection);

    if (selection.spec === null || selection.fileKey === null) {
      dispatch({
        type: "documentIdle",
        workspacePath,
        ...(selection.spec === null ? {} : { specId: selection.spec.id }),
        token,
      });
      return true;
    }

    return await loadDocument(
      token,
      workspacePath,
      selection.spec.id,
      selection.fileKey,
    );
  };

  /**
   * @param token - Active operation token.
   * @param workspacePath - Active workspace identity.
   * @param specId - Selected spec identity.
   * @param fileKey - Selected logical file key.
   * @returns Whether the document read completed successfully and remained current.
   */
  const loadDocument = async (
    token: SpecOperationToken,
    workspacePath: WorkspacePath,
    specId: SpecId,
    fileKey: SpecFileKey,
  ): Promise<boolean> => {
    if (!operationRegistry.isCurrent(token)) {
      return false;
    }

    const correlationId = createPerformanceCorrelationId("document-read");
    dispatch({
      type: "documentLoading",
      workspacePath,
      specId,
      fileKey,
      correlationId,
      token,
    });
    const endSpan = startPerformanceSpan(correlationId, "document.read", {
      specId,
      fileKey,
    });
    const result = await readSpecDocument(gateway, {
      workspacePath,
      specId,
      fileKey,
      correlationId,
    });

    endSpan(result.ok ? documentMetrics(result.value) : { error: true });
    if (!operationRegistry.isCurrent(token)) {
      return false;
    }

    if (!result.ok) {
      dispatch({
        type: "documentFailed",
        workspacePath,
        specId,
        fileKey,
        error: result.error,
        correlationId,
        token,
      });
      return false;
    }

    dispatch({
      type: "documentLoaded",
      workspacePath,
      specId,
      document: result.value,
      correlationId,
      token,
    });
    return true;
  };

  /**
   * @param token - Active operation token.
   * @param workspacePath - Active workspace identity.
   * @param preferredSelection - Selection to retain when it still exists.
   * @returns Whether tree and selected document loading succeeded.
   */
  const loadTreeAndSelection = async (
    token: SpecOperationToken,
    workspacePath: WorkspacePath,
    preferredSelection: PreferredSelection,
  ): Promise<boolean> => {
    dispatch({ type: "treeLoading", workspacePath, token });
    const result = await listSpecs(gateway, { workspacePath });

    if (!operationRegistry.isCurrent(token)) {
      return false;
    }

    if (!result.ok) {
      dispatch({
        type: "treeFailed",
        workspacePath,
        error: result.error,
        token,
      });
      publishSelection(token, workspacePath, {
        specId: null,
        fileKey: null,
      });
      return false;
    }

    dispatch({
      type: "treeLoaded",
      workspacePath,
      tree: result.value,
      token,
    });
    const selection = selectSpecFile(result.value, {
      kind: "preferred",
      ...preferredSelection,
    });
    return await loadSelection(token, workspacePath, selection);
  };

  /**
   * @param workspacePath - Active workspace identity.
   * @param operation - Workflow that owns the exclusive operation token.
   * @returns The workflow result, or false when another operation is active.
   */
  const runExclusive = async (
    workspacePath: WorkspacePath,
    operation: (token: SpecOperationToken) => Promise<boolean>,
  ): Promise<boolean> => {
    const token = operationRegistry.tryStart(workspacePath);
    if (token === null) {
      return false;
    }

    dispatch({ type: "operationStarted", token });
    try {
      return await operation(token);
    } finally {
      dispatch({ type: "operationFinished", token });
      operationRegistry.finish(token);
    }
  };

  /**
   * @param workspacePath - Workspace becoming active, or null when closed.
   * @returns Whether initial tree and document loading succeeded.
   */
  const synchronizeWorkspace = async (
    workspacePath: WorkspacePath | null,
  ): Promise<boolean> => {
    operationRegistry.activateWorkspace(workspacePath);
    if (workspacePath === null) {
      dispatch({ type: "workspaceCleared" });
      onSelectionChange?.({ workspacePath: null, specId: null, fileKey: null });
      return true;
    }

    const token = operationRegistry.tryStart(workspacePath);
    if (token === null) {
      return false;
    }

    dispatch({ type: "workspaceLoadStarted", workspacePath, token });
    publishSelection(token, workspacePath, {
      specId: null,
      fileKey: null,
    });
    try {
      return await loadTreeAndSelection(token, workspacePath, {
        specId: null,
        fileKey: null,
      });
    } finally {
      dispatch({ type: "operationFinished", token });
      operationRegistry.finish(token);
    }
  };

  /** Invalidates every completion owned by the current workspace effect. */
  const cancelWorkspace = (): void => {
    operationRegistry.activateWorkspace(null);
  };

  /**
   * @param input - Active workspace and preferred selection snapshot.
   * @returns Whether tree and selected document loading succeeded.
   */
  const reloadSpecs = async (input: ReloadSpecsInput): Promise<boolean> =>
    await runExclusive(
      input.workspacePath,
      async (token) =>
        await loadTreeAndSelection(
          token,
          input.workspacePath,
          input.preferredSelection,
        ),
    );

  /**
   * @param input - Active tree and validated spec selection.
   * @returns Whether selection and document loading succeeded.
   */
  const selectSpec = async (input: SelectSpecInput): Promise<boolean> =>
    await runExclusive(input.workspacePath, async (token) => {
      const selection = selectSpecFile(input.tree, {
        kind: "spec",
        specId: input.specId,
      });
      if (selection.spec === null) {
        return false;
      }

      return await loadSelection(token, input.workspacePath, selection);
    });

  /**
   * @param input - Active tree and validated spec-file selection.
   * @returns Whether selection and document loading succeeded.
   */
  const selectFile = async (input: SelectFileInput): Promise<boolean> =>
    await runExclusive(input.workspacePath, async (token) => {
      const selection = selectSpecFile(input.tree, {
        kind: "file",
        specId: input.specId,
        fileKey: input.fileKey,
      });
      if (selection.spec === null) {
        return false;
      }

      return await loadSelection(token, input.workspacePath, selection);
    });

  /**
   * @param input - Current validated document identity.
   * @returns Whether document loading succeeded.
   */
  const reloadDocument = async (input: ReloadDocumentInput): Promise<boolean> =>
    await runExclusive(
      input.workspacePath,
      async (token) =>
        await loadDocument(
          token,
          input.workspacePath,
          input.specId,
          input.fileKey,
        ),
    );

  /**
   * @param input - Spec to archive and selection to retain after reload.
   * @returns Whether archive and post-archive reload succeeded.
   */
  const archiveSpec = async (
    input: ArchiveSpecServiceInput,
  ): Promise<boolean> =>
    await runExclusive(input.workspacePath, async (token) => {
      dispatch({ type: "archiveStarted", specId: input.specId, token });
      try {
        const result = await runArchiveSpec(gateway, {
          workspacePath: input.workspacePath,
          specId: input.specId,
        });
        if (!operationRegistry.isCurrent(token)) {
          return false;
        }
        if (!result.ok) {
          dispatch({ type: "archiveFailed", error: result.error, token });
          return false;
        }

        return await loadTreeAndSelection(
          token,
          input.workspacePath,
          input.preferredSelection,
        );
      } finally {
        dispatch({ type: "archiveFinished", token });
      }
    });

  /**
   * @param workspacePath - Current workspace, or null when none is active.
   */
  const resetSelection = (workspacePath: WorkspacePath | null): void => {
    operationRegistry.activateWorkspace(workspacePath);
    if (workspacePath === null) {
      dispatch({ type: "workspaceCleared" });
    } else {
      dispatch({ type: "selectionReset", workspacePath });
    }
    onSelectionChange?.({ workspacePath, specId: null, fileKey: null });
  };

  /**
   * @param token - Operation that proposes the selection change.
   * @param workspacePath - Active workspace identity.
   * @param selection - Selection to publish to app composition.
   */
  function publishSelection(
    token: SpecOperationToken,
    workspacePath: WorkspacePath,
    selection: SpecSelectionState,
  ): void {
    if (!operationRegistry.isCurrent(token)) {
      return;
    }

    onSelectionChange?.({ workspacePath, ...selection });
  }

  return {
    synchronizeWorkspace,
    cancelWorkspace,
    reloadSpecs,
    selectSpec,
    selectFile,
    reloadDocument,
    archiveSpec,
    resetSelection,
  };
}

/**
 * @param document - Loaded document whose read metrics are recorded.
 * @returns Stable document read completion metadata.
 */
function documentMetrics(document: SpecDocument): PerformanceMetadata {
  return {
    bytes:
      document.kind === "markdown" || document.kind === "html"
        ? document.contents.length
        : 0,
    blockCount: document.kind === "markdown" ? document.blocks.length : 0,
    missing: document.kind === "missing",
  };
}
