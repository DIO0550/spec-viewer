import { useEffect, useRef, type RefObject } from "react";

import type { SpecDocumentState } from "@/features/specs/hooks/useSpecs";

/**
 * Resets the viewer scroll position and focus whenever loaded content changes.
 *
 * @param panelRef - Viewer panel element reference.
 * @param resetKey - Stable key that changes when viewer content changes.
 * @param shouldFocus - Whether the viewer panel should receive focus after reset.
 */
export function useViewerReset(
  panelRef: RefObject<HTMLElement | null>,
  resetKey: string,
  shouldFocus: boolean,
): void {
  const previousResetKeyRef = useRef(resetKey);

  useEffect(() => {
    if (previousResetKeyRef.current === resetKey) {
      return;
    }

    previousResetKeyRef.current = resetKey;
    const panel = panelRef.current;

    if (panel === null) {
      return;
    }

    panel.parentElement?.scrollTo({ top: 0, left: 0, behavior: "auto" });

    if (shouldFocus) {
      panel.focus({ preventScroll: true });
    }
  }, [panelRef, resetKey, shouldFocus]);
}

/**
 * @param state - Current spec document state.
 * @returns A stable key for viewer content state transitions.
 */
export function createViewerResetKey(state: SpecDocumentState): string {
  const path = state.document?.path ?? "";
  const contentsLength = state.document?.contents?.length ?? 0;

  return [
    state.status,
    state.workspacePath ?? "",
    state.specId ?? "",
    state.fileKey ?? "",
    path,
    String(contentsLength),
  ].join(":");
}
