import { type RefObject, useEffect } from "react";

import type {
  Comment,
  CommentAnchorDisplayState,
  CommentId,
} from "@/features/comments/types/comment";
import { CommentAnchorDisplay } from "@/features/specs/domain/commentAnchorDisplay";

type UseActiveCommentScrollOptions = Readonly<{
  activeCommentId: CommentId | null;
  comments: readonly Comment[];
  anchorDisplayStates: readonly CommentAnchorDisplayState[];
  renderedRootRef: RefObject<HTMLElement | null>;
}>;

/**
 * Scrolls the active comment's Markdown block into view when it exists.
 *
 * @param input - Active comment, visible comments, and the rendered root
 */
function scrollActiveCommentIntoView({
  activeCommentId,
  comments,
  renderedRoot,
}: Readonly<{
  activeCommentId: CommentId | null;
  comments: readonly Comment[];
  renderedRoot: HTMLElement | null;
}>): void {
  if (activeCommentId === null || renderedRoot === null) {
    return;
  }

  const activeComment = comments.find(
    (comment) => comment.id === activeCommentId,
  );

  if (activeComment === undefined) {
    return;
  }

  const block = CommentAnchorDisplay.findBlockForScroll({
    comment: activeComment,
    renderedRoot,
  });

  if (block === null) {
    return;
  }

  if (typeof block.scrollIntoView === "function") {
    block.scrollIntoView({ block: "center", behavior: "smooth" });
  }

  block.focus({ preventScroll: true });
}

/**
 * Keeps the active comment's block scrolled into view after renders.
 *
 * @param options - Active comment, visible comments, and rendered DOM inputs
 */
export function useActiveCommentScroll({
  activeCommentId,
  comments,
  anchorDisplayStates,
  renderedRootRef,
}: UseActiveCommentScrollOptions): void {
  // biome-ignore lint/correctness/useExhaustiveDependencies(anchorDisplayStates): アンカー表示状態の更新でDOMが再描画された後に再スクロールするための意図的な依存
  useEffect(() => {
    scrollActiveCommentIntoView({
      activeCommentId,
      comments,
      renderedRoot: renderedRootRef.current,
    });
  }, [activeCommentId, anchorDisplayStates, comments, renderedRootRef]);
}
