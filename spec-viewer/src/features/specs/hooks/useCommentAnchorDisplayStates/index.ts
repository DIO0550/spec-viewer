import { type RefObject, useEffect, useState } from "react";

import type {
  Comment,
  CommentAnchorDisplayState,
} from "@/features/comments/types/comment";
import { CommentAnchorDisplay } from "@/features/specs/domain/commentAnchorDisplay";
import type { SpecDocumentState } from "@/features/specs/hooks/useSpecs";

type UseCommentAnchorDisplayStatesOptions = Readonly<{
  comments: readonly Comment[];
  renderedRootRef: RefObject<HTMLElement | null>;
  status: SpecDocumentState["status"];
  readyContents: string | null;
  isHtmlDocument: boolean;
  resetKey: string;
  /** @param states - Anchor display states derived from the rendered DOM */
  onChange?: (states: readonly CommentAnchorDisplayState[]) => void;
}>;

/**
 * Derives comment anchor display states from the rendered Markdown DOM.
 *
 * @param options - Comments, rendered root, and document readiness inputs
 * @returns Anchor display states for the currently rendered document.
 */
export function useCommentAnchorDisplayStates({
  comments,
  renderedRootRef,
  status,
  readyContents,
  isHtmlDocument,
  resetKey,
  onChange,
}: UseCommentAnchorDisplayStatesOptions): readonly CommentAnchorDisplayState[] {
  const [anchorDisplayStates, setAnchorDisplayStates] = useState<
    readonly CommentAnchorDisplayState[]
  >([]);

  // biome-ignore lint/correctness/useExhaustiveDependencies(resetKey): 表示ドキュメントの切り替え（resetKey変更）を契機にアンカー表示状態を初期化するための意図的な依存
  useEffect(() => {
    setAnchorDisplayStates([]);
    onChange?.([]);
  }, [onChange, resetKey]);
  useEffect(() => {
    if (status !== "ready" || readyContents === null || isHtmlDocument) {
      setAnchorDisplayStates([]);
      onChange?.([]);
      return;
    }

    if (renderedRootRef.current === null) {
      return;
    }

    const nextStates = CommentAnchorDisplay.createStates({
      comments,
      renderedRoot: renderedRootRef.current,
    });

    setAnchorDisplayStates(nextStates);
    onChange?.(nextStates);
  }, [
    comments,
    isHtmlDocument,
    onChange,
    readyContents,
    renderedRootRef,
    status,
  ]);

  return anchorDisplayStates;
}
