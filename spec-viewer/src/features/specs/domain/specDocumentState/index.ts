import type { SpecFileKey } from "@/features/specs/domain/specFile";
import type { SpecDocument } from "@/features/specs/types/spec";

export type SpecDocumentState<TError = unknown> =
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
      error: TError;
    }>;

type CorrelationFields = Readonly<{ correlationId?: string }>;

export const SpecDocumentState = {
  /**
   * @param workspacePath - Active workspace path, or null when none is selected
   * @param specId - Optional selected spec id
   * @param fileKey - Optional selected file key
   * @returns Idle document state for the selection context.
   */
  idle: (
    workspacePath: string | null,
    specId: string | null = null,
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
    specId: string,
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
   * @param fileKey - Selected file key
   * @param document - Loaded document
   * @param correlationId - Optional performance correlation id
   * @returns Ready or missing document state based on the loaded document.
   */
  loaded: (
    workspacePath: string,
    specId: string,
    fileKey: SpecFileKey,
    document: SpecDocument,
    correlationId?: string,
  ): SpecDocumentState<never> => ({
    status: document.missing ? "missing" : "ready",
    workspacePath,
    specId,
    fileKey,
    ...createCorrelationFields(correlationId),
    document,
    error: null,
  }),

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
    specId: string,
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
