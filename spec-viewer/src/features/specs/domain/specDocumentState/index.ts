import type { SpecDocument, SpecFileKey } from "@/features/specs/types/spec";
import type { NormalizedCommandError } from "@/shared/types/ipc";

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

type DocumentRequestContext = Readonly<{
  workspacePath: string;
  specId: string;
  fileKey: SpecFileKey;
  correlationId?: string;
}>;

export const SpecDocumentState = {
  /**
   * @param workspacePath - Active workspace path, or null when none is open
   * @param specId - Selected spec id, or null when nothing is selected
   * @param fileKey - Selected file key, or null when nothing is selected
   * @returns Idle Markdown document state for the current selection context.
   */
  idle(
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
  },
  /**
   * @param context - Document request identity for the read in flight
   * @returns The loading document state for a spec file read in flight.
   */
  loading(context: DocumentRequestContext): SpecDocumentState {
    return {
      ...context,
      status: "loading",
      document: null,
      error: null,
    };
  },
  /**
   * @param input - Document request identity and loaded document
   * @returns The ready state, or the missing state for a missing file.
   */
  fromDocument({
    document,
    ...context
  }: DocumentRequestContext &
    Readonly<{ document: SpecDocument }>): SpecDocumentState {
    return {
      ...context,
      status: document.missing ? "missing" : "ready",
      document,
      error: null,
    };
  },
  /**
   * @param input - Document request identity and normalized read failure
   * @returns The error document state for a failed spec file read.
   */
  failed({
    error,
    ...context
  }: DocumentRequestContext &
    Readonly<{ error: NormalizedCommandError }>): SpecDocumentState {
    return {
      ...context,
      status: "error",
      document: null,
      error,
    };
  },
} as const;
