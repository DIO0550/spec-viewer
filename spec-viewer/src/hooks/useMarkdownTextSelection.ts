import { type RefObject, useEffect, useState } from "react";

import { createCommentAnchorDraftFromSelection } from "../lib/comment-anchor-draft";
import type { CommentAnchorDraft } from "../types/comment";
import type { SpecFileKey } from "../types/spec";

type UseMarkdownTextSelectionOptions = Readonly<{
  renderedRootRef: RefObject<HTMLElement | null>;
  fileKey: SpecFileKey | null;
}>;

type UseMarkdownTextSelectionResult = Readonly<{
  selectionDraft: CommentAnchorDraft | null;
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

    document.addEventListener("selectionchange", updateSelectionDraft);
    window.addEventListener("mouseup", updateSelectionDraft);
    window.addEventListener("keyup", updateSelectionDraft);

    return () => {
      document.removeEventListener("selectionchange", updateSelectionDraft);
      window.removeEventListener("mouseup", updateSelectionDraft);
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
