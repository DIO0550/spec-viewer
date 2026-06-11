import { useLayoutEffect, useRef } from "react";

import type { SpecDocumentState } from "@/features/specs/hooks/useSpecs";
import { recordPerformancePoint } from "@/shared/lib/performance";
import { getUtf8ByteLength } from "@/shared/lib/utf8";

type UseFirstReadableOptions = Readonly<{
  status: SpecDocumentState["status"];
  readyContents: string | null;
  resetKey: string;
  correlationId: string | undefined;
  syntaxHighlightMaxBytes: number;
  /** Notifies the caller once per document when contents become readable. */
  onFirstReadable?: () => void;
}>;

/**
 * Records the first-readable performance point once per displayed document.
 *
 * @param options - Document readiness inputs and the notification callback
 */
export function useFirstReadable({
  status,
  readyContents,
  resetKey,
  correlationId,
  syntaxHighlightMaxBytes,
  onFirstReadable,
}: UseFirstReadableOptions): void {
  const firstReadableResetKeyRef = useRef<string | null>(null);

  useLayoutEffect(() => {
    if (status !== "ready" || readyContents === null) {
      firstReadableResetKeyRef.current = null;
      return;
    }

    if (firstReadableResetKeyRef.current === resetKey) {
      return;
    }

    firstReadableResetKeyRef.current = resetKey;
    const byteLength = getUtf8ByteLength(readyContents);
    recordPerformancePoint(
      correlationId ?? resetKey,
      "document.firstReadable",
      {
        bytes: byteLength,
        syntaxHighlight: byteLength <= syntaxHighlightMaxBytes,
      },
    );
    onFirstReadable?.();
  }, [
    correlationId,
    onFirstReadable,
    readyContents,
    resetKey,
    status,
    syntaxHighlightMaxBytes,
  ]);
}
