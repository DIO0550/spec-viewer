import { useState } from "react";

import { DocumentReadability } from "@/features/specs/domain/documentReadability";
import type { SpecDocumentState } from "@/features/specs/hooks/useSpecs";

type UseDocumentReadableOptions = Readonly<{
  documentState: SpecDocumentState;
}>;

type UseDocumentReadableResult = Readonly<{
  isDocumentReadable: boolean;
  /** Marks the currently displayed document as readable. */
  markCurrentDocumentReadable: () => void;
}>;

/**
 * Tracks whether the currently displayed document has become readable.
 *
 * @param options - Current spec document state
 * @returns Readability flag and the first-readable notification handler.
 */
export function useDocumentReadable({
  documentState,
}: UseDocumentReadableOptions): UseDocumentReadableResult {
  const [readableDocumentKey, setReadableDocumentKey] = useState<string | null>(
    null,
  );
  const currentDocumentKey = DocumentReadability.createKey(documentState);
  const isDocumentReadable = DocumentReadability.isReadable({
    status: documentState.status,
    currentKey: currentDocumentKey,
    readableKey: readableDocumentKey,
  });

  const markCurrentDocumentReadable = (): void => {
    setReadableDocumentKey(currentDocumentKey);
  };

  return { isDocumentReadable, markCurrentDocumentReadable };
}
