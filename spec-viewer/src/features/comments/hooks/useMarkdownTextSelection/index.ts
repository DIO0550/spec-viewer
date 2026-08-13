import { type RefObject, useEffect, useState } from "react";

import { createCommentAnchorDraftFromSelection } from "@/features/comments/lib/comment-anchor-draft";
import type { CommentAnchorDraft } from "@/features/comments/types/comment";
import type { SpecFileKey } from "@/features/specs/types/spec";

type UseMarkdownTextSelectionOptions = Readonly<{
  renderedRootRef: RefObject<HTMLElement | null>;
  fileKey: SpecFileKey | null;
}>;

type UseMarkdownTextSelectionResult = Readonly<{
  selectionDraft: CommentAnchorDraft | null;
  /** Clears the current selection draft. */
  clearSelectionDraft: () => void;
}>;

/** @returns The current comment anchor draft for selected Markdown text. */
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

    const updateSelectionDraftFromMouse = (event: MouseEvent): void => {
      if (event.button !== 0) {
        return;
      }

      updateSelectionDraft();
    };

    const updateSelectionDraftFromKeyboard = (event: KeyboardEvent): void => {
      if (isCopyShortcut(event)) {
        return;
      }

      updateSelectionDraft();
    };

    document.addEventListener("selectionchange", clearInvalidSelectionDraft);
    window.addEventListener("mouseup", updateSelectionDraftFromMouse);
    window.addEventListener("touchend", updateSelectionDraft);
    window.addEventListener("keyup", updateSelectionDraftFromKeyboard);

    return () => {
      document.removeEventListener(
        "selectionchange",
        clearInvalidSelectionDraft,
      );
      window.removeEventListener("mouseup", updateSelectionDraftFromMouse);
      window.removeEventListener("touchend", updateSelectionDraft);
      window.removeEventListener("keyup", updateSelectionDraftFromKeyboard);
    };
  }, [fileKey, renderedRootRef]);

  return {
    selectionDraft,
    clearSelectionDraft: () => {
      setSelectionDraft(null);
    },
  };
}

/** @returns true when both range endpoints are inside the rendered Markdown root. */
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
 * @param node - Selection node to test for membership in the root.
 * @returns true when the node or its parent element belongs to the root.
 */
function containsSelectionNode(root: HTMLElement, node: Node): boolean {
  if (node.nodeType === Node.ELEMENT_NODE) {
    return root.contains(node);
  }

  return node.parentElement !== null && root.contains(node.parentElement);
}

/** @returns true when the keyboard event is a platform copy shortcut. */
function isCopyShortcut(event: KeyboardEvent): boolean {
  return (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "c";
}
