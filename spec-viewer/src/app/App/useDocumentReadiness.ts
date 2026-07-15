import { useCallback, useMemo, useState } from "react";

import {
  DocumentIdentity,
  SpecDocumentPolicy,
  type DocumentIdentityType,
  type SpecDocumentState,
  type SpecNodeCapabilities,
} from "@/features/specs";
import { WorkspacePath } from "@/shared/domain/workspacePath";

export type DocumentReadiness = Readonly<{
  documentIdentity: DocumentIdentityType | null;
  isDocumentReadable: boolean;
  isDocumentCommentable: boolean;
  /** Marks the current document as readable. */
  markCurrentDocumentReadable: () => void;
}>;

/**
 * @param documentState - Current document load state.
 * @param nodeCapabilities - Explicit capabilities of the selected spec node.
 * @returns UI readiness and commentability for the current document.
 */
export function useDocumentReadiness(
  documentState: SpecDocumentState,
  nodeCapabilities: SpecNodeCapabilities,
): DocumentReadiness {
  const [readableDocumentIdentity, setReadableDocumentIdentity] =
    useState<DocumentIdentityType | null>(null);
  const documentIdentity = useMemo(
    () => createDocumentIdentity(documentState),
    [documentState],
  );
  const capabilities = useMemo(() => {
    if (
      documentState.status !== "ready" &&
      documentState.status !== "missing"
    ) {
      return null;
    }

    return SpecDocumentPolicy.capabilities(
      documentState.document,
      nodeCapabilities,
    );
  }, [documentState, nodeCapabilities]);
  const isImmediatelyReadable = capabilities?.readability === "immediate";
  const hasRenderAcknowledgement =
    documentIdentity !== null &&
    DocumentIdentity.equals(documentIdentity, readableDocumentIdentity);
  const isDocumentReadable = isImmediatelyReadable || hasRenderAcknowledgement;
  const markCurrentDocumentReadable = useCallback((): void => {
    setReadableDocumentIdentity(documentIdentity);
  }, [documentIdentity]);

  return {
    documentIdentity,
    isDocumentReadable,
    isDocumentCommentable: capabilities?.commentable ?? false,
    markCurrentDocumentReadable,
  };
}

/**
 * @param state - Current document state.
 * @returns Structured identity for a loaded document, or null otherwise.
 */
export function createDocumentIdentity(
  state: SpecDocumentState,
): DocumentIdentityType | null {
  if (state.status !== "ready" && state.status !== "missing") {
    return null;
  }

  return DocumentIdentity.create({
    workspacePath: WorkspacePath.fromString(state.workspacePath),
    specId: state.specId,
    fileKey: state.fileKey,
    loadRevision: state.loadRevision,
  });
}
