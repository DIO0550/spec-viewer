import { type RefObject, useEffect, useState } from "react";

import { createCommentAnchorDraftFromSelection } from "@/features/comments/lib/comment-anchor-draft";
import type { CommentAnchorDraft } from "@/features/comments/types/comment";
import type { SpecFileKey } from "@/shared/types/specFileKey";

type UseMarkdownTextSelectionOptions = Readonly<{
  renderedRootRef: RefObject<HTMLElement | null>;
  fileKey: SpecFileKey | null;
}>;

type UseMarkdownTextSelectionResult = Readonly<{
  selectionDraft: CommentAnchorDraft | null;
  /** Clears the current selection draft. */
  clearSelectionDraft: () => void;
}>;

/**
 * @param options - Rendered Markdown root ref and active file key.
 * @returns The current comment anchor draft for selected Markdown text.
 */
export function useMarkdownTextSelection({
  renderedRootRef,
  fileKey,
}: UseMarkdownTextSelectionOptions): UseMarkdownTextSelectionResult {
  const [selectionDraft, setSelectionDraft] =
    useState<CommentAnchorDraft | null>(null);

  useEffect(() => {
    setSelectionDraft(null);

    if (fileKey === null) {
      return;
    }

    const updateSelectionDraft = (): void => {
      const nextDraft = createCommentAnchorDraftFromSelection({
        selection: document.getSelection(),
        renderedRoot: renderedRootRef.current,
        fileKey,
      });

      setSelectionDraft(nextDraft);
    };

    const clearInvalidSelectionDraft = (): void => {
      const selection = document.getSelection();

      if (
        selection === null ||
        renderedRootRef.current === null ||
        selection.rangeCount === 0
      ) {
        setSelectionDraft(null);
        return;
      }

      const range = selection.getRangeAt(0);

      if (
        range.collapsed ||
        !isRangeEndpointInsideRoot(range, renderedRootRef.current)
      ) {
        setSelectionDraft(null);
      }
    };

    document.addEventListener("selectionchange", clearInvalidSelectionDraft);
    window.addEventListener("mouseup", updateSelectionDraft);
    window.addEventListener("touchend", updateSelectionDraft);
    window.addEventListener("keyup", updateSelectionDraft);

    return () => {
      document.removeEventListener(
        "selectionchange",
        clearInvalidSelectionDraft,
      );
      window.removeEventListener("mouseup", updateSelectionDraft);
      window.removeEventListener("touchend", updateSelectionDraft);
      window.removeEventListener("keyup", updateSelectionDraft);
    };
  }, [fileKey, renderedRootRef]);

  return {
    selectionDraft,
    clearSelectionDraft: () => {
      setSelectionDraft(null);
    },
  };
}

/**
 * @param range - Selection range to test.
 * @param renderedRoot - Rendered Markdown root element.
 * @returns true when both range endpoints are inside the rendered Markdown root.
 */
function isRangeEndpointInsideRoot(
  range: Range,
  renderedRoot: HTMLElement,
): boolean {
  return (
    containsSelectionNode(renderedRoot, range.startContainer) &&
    containsSelectionNode(renderedRoot, range.endContainer)
  );
}

/**
 * @param root - Rendered Markdown root element.
 * @param node - Node to test for containment.
 * @returns true when the node or its parent element belongs to the root.
 */
function containsSelectionNode(root: HTMLElement, node: Node): boolean {
  if (node.nodeType === Node.ELEMENT_NODE) {
    return root.contains(node);
  }

  return node.parentElement !== null && root.contains(node.parentElement);
}
