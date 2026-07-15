import type {
  SpecDocumentFeatureState,
  SpecFeatureError,
  SpecTreeFeatureState,
} from "@/features/specs/application/specError";
import type { SpecOperationToken } from "@/features/specs/application/specOperation";
import type { SpecDocument } from "@/features/specs/domain/specDocument";
import { SpecDocumentState } from "@/features/specs/domain/specDocumentState";
import type { SpecTree } from "@/features/specs/domain/specTree";
import { SpecTreeState } from "@/features/specs/domain/specTreeState";
import type { SpecFileKey } from "@/shared/domain/specFileKey";
import type { SpecId } from "@/shared/domain/specId";
import type { WorkspacePath } from "@/shared/domain/workspacePath";

export type SpecSelectionState = Readonly<{
  specId: SpecId | null;
  fileKey: SpecFileKey | null;
}>;

export type SpecsState = Readonly<{
  workspacePath: WorkspacePath | null;
  specTreeState: SpecTreeFeatureState;
  documentState: SpecDocumentFeatureState;
  selection: SpecSelectionState;
  isLoading: boolean;
  activeOperationToken: SpecOperationToken | null;
  archivingSpecId: SpecId | null;
  archiveSpecError: SpecFeatureError | null;
}>;

type OperationEvent =
  | Readonly<{
      type: "operationStarted";
      token: SpecOperationToken;
    }>
  | Readonly<{
      type: "operationFinished";
      token: SpecOperationToken;
    }>
  | Readonly<{
      type: "treeLoading";
      workspacePath: WorkspacePath;
      token: SpecOperationToken;
    }>
  | Readonly<{
      type: "treeLoaded";
      workspacePath: WorkspacePath;
      tree: SpecTree;
      token: SpecOperationToken;
    }>
  | Readonly<{
      type: "treeFailed";
      workspacePath: WorkspacePath;
      error: SpecFeatureError;
      token: SpecOperationToken;
    }>
  | Readonly<{
      type: "selectionChanged";
      selection: SpecSelectionState;
      token: SpecOperationToken;
    }>
  | Readonly<{
      type: "documentIdle";
      workspacePath: WorkspacePath;
      specId?: SpecId;
      token: SpecOperationToken;
    }>
  | Readonly<{
      type: "documentLoading";
      workspacePath: WorkspacePath;
      specId: SpecId;
      fileKey: SpecFileKey;
      correlationId: string;
      token: SpecOperationToken;
    }>
  | Readonly<{
      type: "documentLoaded";
      workspacePath: WorkspacePath;
      specId: SpecId;
      document: SpecDocument;
      correlationId: string;
      token: SpecOperationToken;
    }>
  | Readonly<{
      type: "documentFailed";
      workspacePath: WorkspacePath;
      specId: SpecId;
      fileKey: SpecFileKey;
      error: SpecFeatureError;
      correlationId: string;
      token: SpecOperationToken;
    }>
  | Readonly<{
      type: "archiveStarted";
      specId: SpecId;
      token: SpecOperationToken;
    }>
  | Readonly<{
      type: "archiveFailed";
      error: SpecFeatureError;
      token: SpecOperationToken;
    }>
  | Readonly<{
      type: "archiveFinished";
      token: SpecOperationToken;
    }>;

export type SpecsStateEvent =
  | Readonly<{
      type: "workspaceLoadStarted";
      workspacePath: WorkspacePath;
      token: SpecOperationToken;
    }>
  | Readonly<{ type: "workspaceCleared" }>
  | Readonly<{
      type: "selectionReset";
      workspacePath: WorkspacePath | null;
    }>
  | OperationEvent;

/** @returns Initial specs application state without an active workspace. */
export function createInitialSpecsState(): SpecsState {
  return {
    workspacePath: null,
    specTreeState: SpecTreeState.idle(),
    documentState: SpecDocumentState.idle(null),
    selection: { specId: null, fileKey: null },
    isLoading: false,
    activeOperationToken: null,
    archivingSpecId: null,
    archiveSpecError: null,
  };
}

/**
 * @param state - Current pure application state.
 * @param event - State transition emitted by the application service.
 * @returns The next immutable state, or the same state for stale events.
 */
export function reduceSpecsState(
  state: SpecsState,
  event: SpecsStateEvent,
): SpecsState {
  if (event.type === "workspaceCleared") {
    return createInitialSpecsState();
  }

  if (event.type === "workspaceLoadStarted") {
    return {
      workspacePath: event.workspacePath,
      specTreeState: SpecTreeState.loading(event.workspacePath),
      documentState: SpecDocumentState.idle(event.workspacePath),
      selection: { specId: null, fileKey: null },
      isLoading: true,
      activeOperationToken: event.token,
      archivingSpecId: null,
      archiveSpecError: null,
    };
  }

  if (event.type === "selectionReset") {
    return {
      ...state,
      workspacePath: event.workspacePath,
      documentState: SpecDocumentState.idle(event.workspacePath),
      selection: { specId: null, fileKey: null },
      isLoading: false,
      activeOperationToken: null,
      archivingSpecId: null,
    };
  }

  if (event.type === "operationStarted") {
    if (state.workspacePath !== event.token.workspacePath) {
      return state;
    }

    return { ...state, activeOperationToken: event.token, isLoading: true };
  }

  if (!isCurrentOperation(state, event.token)) {
    return state;
  }

  switch (event.type) {
    case "operationFinished":
      return { ...state, activeOperationToken: null, isLoading: false };
    case "treeLoading":
      return {
        ...state,
        specTreeState: SpecTreeState.loading(event.workspacePath),
      };
    case "treeLoaded":
      return {
        ...state,
        specTreeState: SpecTreeState.loaded(event.workspacePath, event.tree),
      };
    case "treeFailed":
      return {
        ...state,
        specTreeState: SpecTreeState.failed(event.workspacePath, event.error),
        documentState: SpecDocumentState.idle(event.workspacePath),
        selection: { specId: null, fileKey: null },
      };
    case "selectionChanged":
      return { ...state, selection: event.selection };
    case "documentIdle":
      return {
        ...state,
        documentState: SpecDocumentState.idle(
          event.workspacePath,
          event.specId ?? null,
        ),
      };
    case "documentLoading":
      return {
        ...state,
        documentState: SpecDocumentState.loading(
          event.workspacePath,
          event.specId,
          event.fileKey,
          event.correlationId,
        ),
      };
    case "documentLoaded":
      return {
        ...state,
        documentState: SpecDocumentState.loaded(
          event.workspacePath,
          event.specId,
          event.document,
          {
            loadRevision: event.correlationId,
            correlationId: event.correlationId,
          },
        ),
      };
    case "documentFailed":
      return {
        ...state,
        documentState: SpecDocumentState.failed(
          event.workspacePath,
          event.specId,
          event.fileKey,
          event.error,
          event.correlationId,
        ),
      };
    case "archiveStarted":
      return {
        ...state,
        archiveSpecError: null,
        archivingSpecId: event.specId,
      };
    case "archiveFailed":
      return { ...state, archiveSpecError: event.error };
    case "archiveFinished":
      return { ...state, archivingSpecId: null };
  }
}

/**
 * @param state - Current state that owns at most one operation.
 * @param token - Token carried by an application event.
 * @returns Whether the event belongs to the active workspace operation.
 */
function isCurrentOperation(
  state: SpecsState,
  token: SpecOperationToken,
): boolean {
  const active = state.activeOperationToken;
  return (
    active !== null &&
    active.sequence === token.sequence &&
    active.workspaceRevision === token.workspaceRevision
  );
}
