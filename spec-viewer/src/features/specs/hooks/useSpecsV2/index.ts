import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { OperationId } from "@/features/specs/domain/operationId";
import {
  SpecArtifact,
  type SpecArtifactIdentity,
} from "@/features/specs/domain/specArtifact";
import { SpecBundleState } from "@/features/specs/domain/specBundleState";
import { SpecDocumentState } from "@/features/specs/domain/specDocumentState";
import { SpecFeatureError } from "@/features/specs/domain/specError";
import { SpecNode } from "@/features/specs/domain/specNode";
import { SpecTree } from "@/features/specs/domain/specTree";
import { SpecTreeState } from "@/features/specs/domain/specTreeState";
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
  SpecArtifact as SpecArtifactType,
  SpecBundle,
  SpecFileKey,
  SpecTree as SpecTreeType,
} from "@/features/specs/types/spec";
import { specCommands } from "@/lib/api/tauri";
import { ArchiveSpecCommandError } from "@/lib/api/tauri/archiveSpec";
import { ListSpecsCommandError } from "@/lib/api/tauri/listSpecs";
import { LoadSpecBundleCommandError } from "@/lib/api/tauri/loadSpecBundle";

export type SpecSelectionChange = Readonly<{
  workspacePath: string | null;
  specId: string | null;
  fileKey: SpecFileKey | null;
}>;

export type UseSpecsOptions = Readonly<{
  workspacePath: string | null;
  onSelectionChange?: (selection: SpecSelectionChange) => void;
}>;

const initialState: SpecsState = {
  specTreeState: SpecTreeState.idle(),
  bundleState: SpecBundleState.idle(),
  documentState: SpecDocumentState.idle(null),
  selection: { specId: null, artifactIdentity: null, fileKey: null },
  isLoading: false,
  activeOperationId: null,
  archivingSpecId: null,
  archiveSpecError: null,
  archiveFailure: null,
  archiveReveal: null,
};

const specFileKeys: readonly SpecFileKey[] = [
  "exploration",
  "hearing",
  "impl",
  "tasks",
  "tech-reference",
  "test-cases",
  "requirements",
  "quiz-plan",
  "quiz-impl",
];

/**
 * Checks whether a raw string is one of the known standard file keys.
 * @param value - Raw string to check.
 * @returns True when `value` matches one of `specFileKeys`.
 */
function isSpecFileKey(value: string): value is SpecFileKey {
  return specFileKeys.some((key) => key === value);
}

/**
 * Finds the artifact matching an identity within an already-loaded bundle.
 * @param bundle - Bundle whose artifacts are searched.
 * @param identity - Identity to match, or null when nothing is selected.
 * @returns The matching artifact, or null when `identity` is null or no artifact matches.
 */
function selectedArtifact(
  bundle: SpecBundle,
  identity: SpecArtifactIdentity | null,
): SpecArtifactType | null {
  if (identity === null) {
    return null;
  }

  const stableId = SpecArtifact.stableId(identity);
  return (
    bundle.artifacts.find(
      (artifact) => SpecArtifact.stableId(artifact.identity) === stableId,
    ) ?? null
  );
}

/**
 * Projects a selected bundle artifact into document state without an IPC read.
 * @param workspacePath - Workspace containing the spec.
 * @param specId - ID of the spec that owns the artifact.
 * @param artifact - Selected artifact, or null when nothing is selected.
 * @returns An idle document state when the artifact is missing, has no file key, or failed to
 * load; otherwise a loaded document state built from the artifact's contents.
 */
function projectDocumentState(
  workspacePath: string,
  specId: string,
  artifact: SpecArtifactType | null,
) {
  if (
    artifact === null ||
    artifact.fileKey === null ||
    artifact.error !== null
  ) {
    return SpecDocumentState.idle(
      workspacePath,
      specId,
      artifact?.fileKey ?? null,
    );
  }

  return SpecDocumentState.loaded(workspacePath, specId, artifact.fileKey, {
    key: artifact.fileKey,
    format: artifact.format,
    path: artifact.path,
    contents: artifact.contents,
    missing: false,
    blocks: artifact.blocks,
  });
}

/**
 * Resolves which spec node should be active after a tree load.
 * @param tree - Freshly loaded spec tree.
 * @param preferredSpecId - Previously selected spec id to keep when still valid, or null.
 * @returns The preferred spec when it exists and is openable, otherwise the tree's default spec.
 */
function resolveSpec(tree: SpecTreeType, preferredSpecId: string | null) {
  if (preferredSpecId !== null) {
    const preferred = SpecTree.findNode(tree, preferredSpecId);
    if (preferred !== null && SpecNode.isOpenable(preferred)) {
      return preferred;
    }
  }

  return SpecTree.defaultNode(tree);
}

/**
 * Bundle-oriented spec state machine. Artifact tab selection is IPC-free.
 * @param options - Hook options including the workspace path and selection callback.
 * @returns Spec tree, bundle, and document state plus actions for a workspace.
 */
export function useSpecs(options: UseSpecsOptions): UseSpecsResult {
  const { onSelectionChange, workspacePath } = options;
  const [state, setState] = useState<SpecsState>(initialState);
  const stateRef = useRef(state);
  stateRef.current = state;
  const workspaceRef = useRef(workspacePath);
  workspaceRef.current = workspacePath;
  const activeOperationRef = useRef<OperationId | null>(null);

  const commit = useCallback(
    (operationId: OperationId, update: (current: SpecsState) => SpecsState) => {
      if (activeOperationRef.current !== operationId) {
        return;
      }

      setState((current) => update(current));
    },
    [],
  );

  const beginOperation = useCallback((): OperationId => {
    const operationId = OperationId.create();
    activeOperationRef.current = operationId;
    setState((current) => ({
      ...current,
      activeOperationId: operationId,
      isLoading: true,
    }));
    return operationId;
  }, []);

  const finishOperation = useCallback((operationId: OperationId): void => {
    if (activeOperationRef.current !== operationId) {
      return;
    }

    activeOperationRef.current = null;
    setState((current) => ({
      ...current,
      activeOperationId: null,
      isLoading: false,
    }));
  }, []);

  const publishSelection = useCallback(
    (specId: string | null, identity: SpecArtifactIdentity | null): void => {
      onSelectionChange?.({
        workspacePath: workspaceRef.current,
        specId,
        fileKey: identity === null ? null : SpecArtifact.fixedFileKey(identity),
      });
    },
    [onSelectionChange],
  );

  const loadBundle = useCallback(
    async (
      operationId: OperationId,
      activeWorkspacePath: string,
      specId: string,
      preferred: SpecArtifactIdentity | null,
    ): Promise<boolean> => {
      commit(operationId, (current) => ({
        ...current,
        bundleState: SpecBundleState.loading(current.bundleState.bundle),
        documentState: SpecDocumentState.idle(activeWorkspacePath, specId),
      }));

      try {
        const bundle = await specGateway.loadSpecBundle(specCommands, {
          workspacePath: activeWorkspacePath,
          specId,
        });
        const identity = SpecArtifact.preserveOrFirst(
          bundle.artifacts,
          preferred,
        );
        const artifact = selectedArtifact(bundle, identity);
        commit(operationId, (current) => ({
          ...current,
          bundleState: SpecBundleState.loaded(bundle),
          documentState: projectDocumentState(
            activeWorkspacePath,
            specId,
            artifact,
          ),
          selection: {
            specId,
            artifactIdentity: identity,
            fileKey:
              identity === null ? null : SpecArtifact.fixedFileKey(identity),
          },
        }));
        if (activeOperationRef.current === operationId) {
          publishSelection(specId, identity);
        }
        return true;
      } catch (error) {
        const featureError = SpecFeatureError.fromCommandError(
          LoadSpecBundleCommandError.fromUnknown(error),
        );
        commit(operationId, (current) => ({
          ...current,
          bundleState: SpecBundleState.failed(featureError),
          documentState: SpecDocumentState.idle(activeWorkspacePath, specId),
          selection: {
            specId,
            artifactIdentity: null,
            fileKey: null,
          },
        }));
        return false;
      }
    },
    [commit, publishSelection],
  );

  const loadTreeAndBundle = useCallback(
    async (
      operationId: OperationId,
      preferredSpecId: string | null,
      preferredArtifact: SpecArtifactIdentity | null,
      onTreeLoaded?: (tree: SpecTreeType) => void,
    ): Promise<boolean> => {
      const activeWorkspacePath = workspaceRef.current;
      if (activeWorkspacePath === null) {
        commit(operationId, () => initialState);
        publishSelection(null, null);
        return true;
      }

      commit(operationId, (current) => ({
        ...current,
        specTreeState: SpecTreeState.loading(activeWorkspacePath),
      }));

      try {
        const tree = await specGateway.listSpecs(
          specCommands,
          activeWorkspacePath,
        );
        if (activeOperationRef.current !== operationId) {
          return false;
        }

        const spec = resolveSpec(tree, preferredSpecId);
        commit(operationId, (current) => ({
          ...current,
          specTreeState: SpecTreeState.loaded(activeWorkspacePath, tree),
        }));
        if (activeOperationRef.current === operationId) {
          onTreeLoaded?.(tree);
        }

        if (spec === null) {
          const emptyBundle: SpecBundle = {
            specId: "",
            progress: "notStarted",
            artifacts: [],
          };
          commit(operationId, (current) => ({
            ...current,
            bundleState: SpecBundleState.loaded(emptyBundle),
            documentState: SpecDocumentState.idle(activeWorkspacePath),
            selection: {
              specId: null,
              artifactIdentity: null,
              fileKey: null,
            },
          }));
          publishSelection(null, null);
          return true;
        }

        const firstFileKey = SpecNode.firstFileKey(spec);
        const preserveArtifact =
          spec.id === preferredSpecId && preferredArtifact !== null
            ? preferredArtifact
            : firstFileKey === null
              ? null
              : { kind: "standard" as const, fileKey: firstFileKey };
        return await loadBundle(
          operationId,
          activeWorkspacePath,
          spec.id,
          preserveArtifact,
        );
      } catch (error) {
        const featureError = SpecFeatureError.fromCommandError(
          ListSpecsCommandError.fromUnknown(error),
        );
        commit(operationId, (current) => ({
          ...current,
          bundleState: SpecBundleState.idle(),
          documentState: SpecDocumentState.idle(activeWorkspacePath),
          selection: {
            specId: null,
            artifactIdentity: null,
            fileKey: null,
          },
          specTreeState: SpecTreeState.failed(
            activeWorkspacePath,
            featureError,
          ),
        }));
        publishSelection(null, null);
        return false;
      }
    },
    [commit, loadBundle, publishSelection],
  );

  useEffect(() => {
    const operationId = beginOperation();
    setState((current) => ({
      ...current,
      bundleState: SpecBundleState.idle(),
      documentState: SpecDocumentState.idle(workspacePath),
      selection: { specId: null, artifactIdentity: null, fileKey: null },
      specTreeState:
        workspacePath === null
          ? SpecTreeState.idle()
          : SpecTreeState.loading(workspacePath),
    }));
    publishSelection(null, null);
    void loadTreeAndBundle(operationId, null, null).finally(() => {
      finishOperation(operationId);
    });
  }, [
    beginOperation,
    finishOperation,
    loadTreeAndBundle,
    publishSelection,
    workspacePath,
  ]);

  const reloadSpecs = useCallback(async (): Promise<boolean> => {
    const operationId = beginOperation();
    const current = stateRef.current;
    try {
      return await loadTreeAndBundle(
        operationId,
        current.selection.specId,
        current.selection.artifactIdentity,
      );
    } finally {
      finishOperation(operationId);
    }
  }, [beginOperation, finishOperation, loadTreeAndBundle]);

  const selectSpec = useCallback(
    async (specId: string): Promise<void> => {
      const activeWorkspacePath = workspaceRef.current;
      const tree = stateRef.current.specTreeState.tree;
      if (activeWorkspacePath === null || tree === null) {
        return;
      }

      const spec = SpecTree.findNode(tree, specId);
      if (spec === null || !SpecNode.isOpenable(spec)) {
        return;
      }

      const operationId = beginOperation();
      try {
        const firstFileKey = SpecNode.firstFileKey(spec);
        const preferred =
          firstFileKey === null
            ? null
            : { kind: "standard" as const, fileKey: firstFileKey };
        await loadBundle(operationId, activeWorkspacePath, specId, preferred);
      } finally {
        finishOperation(operationId);
      }
    },
    [beginOperation, finishOperation, loadBundle],
  );

  const selectArtifact = useCallback(
    (identity: SpecArtifactIdentity): void => {
      const current = stateRef.current;
      const bundle = current.bundleState.bundle;
      const activeWorkspacePath = workspaceRef.current;
      const specId = current.selection.specId;
      if (bundle === null || activeWorkspacePath === null || specId === null) {
        return;
      }

      const artifact = selectedArtifact(bundle, identity);
      if (artifact === null) {
        return;
      }

      setState((previous) => ({
        ...previous,
        documentState: projectDocumentState(
          activeWorkspacePath,
          specId,
          artifact,
        ),
        selection: {
          specId,
          artifactIdentity: artifact.identity,
          fileKey: SpecArtifact.fixedFileKey(artifact.identity),
        },
      }));
      publishSelection(specId, artifact.identity);
    },
    [publishSelection],
  );

  const selectFileKey = useCallback(
    async (fileKey: SpecFileKey): Promise<void> => {
      selectArtifact({ kind: "standard", fileKey });
    },
    [selectArtifact],
  );

  const selectSpecFile = useCallback(
    async (specId: string, fileKey: string): Promise<void> => {
      if (!isSpecFileKey(fileKey)) {
        return;
      }
      const identity = { kind: "standard", fileKey } as const;

      if (stateRef.current.selection.specId === specId) {
        selectArtifact(identity);
        return;
      }

      const activeWorkspacePath = workspaceRef.current;
      if (activeWorkspacePath === null) {
        return;
      }

      const operationId = beginOperation();
      try {
        await loadBundle(operationId, activeWorkspacePath, specId, identity);
      } finally {
        finishOperation(operationId);
      }
    },
    [beginOperation, finishOperation, loadBundle, selectArtifact],
  );

  const reloadDocument = useCallback(async (): Promise<boolean> => {
    const current = stateRef.current;
    const activeWorkspacePath = workspaceRef.current;
    if (activeWorkspacePath === null || current.selection.specId === null) {
      return true;
    }

    const operationId = beginOperation();
    try {
      return await loadBundle(
        operationId,
        activeWorkspacePath,
        current.selection.specId,
        current.selection.artifactIdentity,
      );
    } finally {
      finishOperation(operationId);
    }
  }, [beginOperation, finishOperation, loadBundle]);

  const archiveSpec = useCallback(
    async (specId: string): Promise<boolean> => {
      const activeWorkspacePath = workspaceRef.current;
      if (activeWorkspacePath === null || stateRef.current.isLoading) {
        return false;
      }

      const operationId = beginOperation();
      commit(operationId, (current) => ({
        ...current,
        archiveFailure: null,
        archiveReveal: null,
        archiveSpecError: null,
        archivingSpecId: specId,
      }));
      try {
        const response = await specGateway.archiveSpec(specCommands, {
          workspacePath: activeWorkspacePath,
          specId,
        });
        const current = stateRef.current;
        return await loadTreeAndBundle(
          operationId,
          current.selection.specId,
          current.selection.artifactIdentity,
          (tree) => {
            const destination = SpecTree.findNodeByIdentity(tree, {
              sourceGroupId: response.sourceGroupId,
              relativeId: response.destinationNodeId,
            });
            commit(operationId, (latest) => ({
              ...latest,
              archiveReveal: {
                status: destination === null ? "missing" : "success",
                workspacePath: activeWorkspacePath,
                response,
              },
            }));
          },
        );
      } catch (error) {
        const featureError = SpecFeatureError.fromCommandError(
          ArchiveSpecCommandError.fromUnknown(error),
        );
        commit(operationId, (current) => ({
          ...current,
          archiveFailure: { specId, error: featureError },
          archiveSpecError: featureError,
          archivingSpecId: null,
        }));
        return false;
      } finally {
        commit(operationId, (current) => ({
          ...current,
          archivingSpecId: null,
        }));
        finishOperation(operationId);
      }
    },
    [beginOperation, commit, finishOperation, loadTreeAndBundle],
  );

  const retryArchiveSpec = useCallback(async (): Promise<boolean> => {
    const failure = stateRef.current.archiveFailure;
    return failure === null ? false : await archiveSpec(failure.specId);
  }, [archiveSpec]);

  const refreshArchiveReveal = useCallback(async (): Promise<boolean> => {
    setState((current) => ({
      ...current,
      archiveFailure: null,
      archiveReveal: null,
      archiveSpecError: null,
    }));
    return await reloadSpecs();
  }, [reloadSpecs]);

  const resetSelection = useCallback((): void => {
    activeOperationRef.current = null;
    setState((current) => ({
      ...current,
      activeOperationId: null,
      bundleState: SpecBundleState.idle(),
      documentState: SpecDocumentState.idle(workspaceRef.current),
      isLoading: false,
      selection: { specId: null, artifactIdentity: null, fileKey: null },
    }));
    publishSelection(null, null);
  }, [publishSelection]);

  const selectors: SpecsSelectors = useMemo(
    () => buildSpecsSelectors(state),
    [state],
  );
  const actions: SpecsActions = useMemo(
    () => ({
      archiveSpec,
      refreshArchiveReveal,
      reloadDocument,
      reloadSpecs,
      resetSelection,
      retryArchiveSpec,
      selectArtifact,
      selectFileKey,
      selectSpec,
      selectSpecFile,
    }),
    [
      archiveSpec,
      refreshArchiveReveal,
      reloadDocument,
      reloadSpecs,
      resetSelection,
      retryArchiveSpec,
      selectArtifact,
      selectFileKey,
      selectSpec,
      selectSpecFile,
    ],
  );

  return { state, actions, selectors };
}
