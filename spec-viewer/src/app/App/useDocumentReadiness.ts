import { useCallback, useMemo, useState } from "react";

import type { SpecDocumentState } from "@/features/specs";

export type DocumentReadiness = Readonly<{
  currentDocumentKey: string | null;
  isDocumentReadable: boolean;
  isHtmlDocument: boolean;
  /** Marks the current document as readable. */
  markCurrentDocumentReadable: () => void;
}>;

/** @returns UI readiness state for comment scope opening around the current document. */
export function useDocumentReadiness(
  documentState: SpecDocumentState,
): DocumentReadiness {
  const [readableDocumentKey, setReadableDocumentKey] = useState<string | null>(
    null,
  );
  const currentDocumentKey = useMemo(
    () => createDocumentReadableKey(documentState),
    [documentState],
  );
  const isHtmlDocument =
    documentState.status === "ready" &&
    documentState.document.format === "html";
  const isDocumentReadable =
    documentState.status === "missing" ||
    (currentDocumentKey !== null && readableDocumentKey === currentDocumentKey);
  const markCurrentDocumentReadable = useCallback((): void => {
    setReadableDocumentKey(currentDocumentKey);
  }, [currentDocumentKey]);

  return {
    currentDocumentKey,
    isDocumentReadable,
    isHtmlDocument,
    markCurrentDocumentReadable,
  };
}

/** @returns A stable identity for the document load that must become readable. */
export function createDocumentReadableKey(
  state: SpecDocumentState,
): string | null {
  if (state.status !== "ready") {
    return null;
  }

  return [
    state.workspacePath,
    state.specId,
    state.fileKey,
    state.correlationId ?? "no-correlation",
  ].join("\u0000");
}
