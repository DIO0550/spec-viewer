import type { SpecDocument } from "@/features/specs/domain/specDocument";
import type { SpecFileKey } from "@/features/specs/domain/specFile";
import type { SpecId } from "@/shared/domain/specId";

export type SpecDocumentState<TError = unknown> =
  | Readonly<{
      status: "idle";
      workspacePath: string | null;
      specId: SpecId | null;
      fileKey: SpecFileKey | null;
      correlationId?: string;
      document: null;
      error: null;
    }>
  | Readonly<{
      status: "loading";
      workspacePath: string;
      specId: SpecId;
      fileKey: SpecFileKey;
      correlationId?: string;
      document: null;
      error: null;
    }>
  | Readonly<{
      status: "ready";
      workspacePath: string;
      specId: SpecId;
      fileKey: SpecFileKey;
      correlationId?: string;
      loadRevision: string;
      document: Exclude<SpecDocument, { kind: "missing" }>;
      error: null;
    }>
  | Readonly<{
      status: "missing";
      workspacePath: string;
      specId: SpecId;
      fileKey: SpecFileKey;
      correlationId?: string;
      loadRevision: string;
      document: Extract<SpecDocument, { kind: "missing" }>;
      error: null;
    }>
  | Readonly<{
      status: "error";
      workspacePath: string;
      specId: SpecId;
      fileKey: SpecFileKey;
      correlationId?: string;
      document: null;
      error: TError;
    }>;

type CorrelationFields = Readonly<{ correlationId?: string }>;
type LoadedDocumentContext = Readonly<{
  loadRevision: string;
  correlationId?: string;
}>;

export const SpecDocumentState = {
  /**
   * @param workspacePath - Active workspace path, or null when none is selected
   * @param specId - Optional selected spec id
   * @param fileKey - Optional selected file key
   * @returns Idle document state for the selection context.
   */
  idle: (
    workspacePath: string | null,
    specId: SpecId | null = null,
    fileKey: SpecFileKey | null = null,
  ): SpecDocumentState<never> => ({
    status: "idle",
    workspacePath,
    specId,
    fileKey,
    document: null,
    error: null,
  }),

  /**
   * @param workspacePath - Active workspace path
   * @param specId - Selected spec id
   * @param fileKey - Selected file key
   * @param correlationId - Optional performance correlation id
   * @returns Loading document state.
   */
  loading: (
    workspacePath: string,
    specId: SpecId,
    fileKey: SpecFileKey,
    correlationId?: string,
  ): SpecDocumentState<never> => ({
    status: "loading",
    workspacePath,
    specId,
    fileKey,
    ...createCorrelationFields(correlationId),
    document: null,
    error: null,
  }),

  /**
   * @param workspacePath - Active workspace path
   * @param specId - Selected spec id
   * @param document - Loaded document
   * @param context - Required load revision and optional correlation id
   * @returns Ready or missing document state based on the loaded document.
   */
  loaded: (
    workspacePath: string,
    specId: SpecId,
    document: SpecDocument,
    context: LoadedDocumentContext,
  ): SpecDocumentState<never> => {
    const sharedState = {
      workspacePath,
      specId,
      fileKey: document.key,
      ...createCorrelationFields(context.correlationId),
      loadRevision: context.loadRevision,
      error: null,
    };

    if (document.kind === "missing") {
      return {
        ...sharedState,
        status: "missing",
        document,
      };
    }

    return {
      ...sharedState,
      status: "ready",
      document,
    };
  },

  /**
   * @param workspacePath - Active workspace path
   * @param specId - Selected spec id
   * @param fileKey - Selected file key
   * @param error - Feature-level spec error
   * @param correlationId - Optional performance correlation id
   * @returns Error document state.
   */
  failed: <TError>(
    workspacePath: string,
    specId: SpecId,
    fileKey: SpecFileKey,
    error: TError,
    correlationId?: string,
  ): SpecDocumentState<TError> => ({
    status: "error",
    workspacePath,
    specId,
    fileKey,
    ...createCorrelationFields(correlationId),
    document: null,
    error,
  }),
} as const;

/**
 * @param correlationId - Optional performance correlation id
 * @returns Correlation fields only when an id exists.
 */
function createCorrelationFields(correlationId?: string): CorrelationFields {
  if (correlationId === undefined) {
    return {};
  }

  return { correlationId };
}
