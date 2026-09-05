import type { DiffLineCommentTarget } from "@/features/diffComments/components/DiffLineCommentControl";

/**
 * Converts the current native text selection into a same-side, same-file line range.
 * Invalid, collapsed, or cross-column selections retain the clicked single-line target.
 */
export function createRangeCommentTarget(
  selection: Selection | null,
  fallbackTarget: DiffLineCommentTarget,
): DiffLineCommentTarget {
  if (selection === null || selection.isCollapsed) {
    return fallbackTarget;
  }

  const anchor = readSelectedLine(selection.anchorNode, fallbackTarget.side);
  const focus = readSelectedLine(selection.focusNode, fallbackTarget.side);
  if (
    anchor === null ||
    focus === null ||
    anchor.path !== fallbackTarget.sidePath ||
    focus.path !== fallbackTarget.sidePath
  ) {
    return fallbackTarget;
  }

  const line = Math.min(anchor.line, focus.line);
  const endLine = Math.max(anchor.line, focus.line);
  if (line === endLine) {
    return fallbackTarget;
  }

  return {
    ...fallbackTarget,
    key: `${fallbackTarget.side}:${fallbackTarget.sidePath}:${endLine}`,
    line,
    endLine,
  };
}

/**
 * @param node - Element currently under the dragged comment button.
 * @param originTarget - Single-line target where the drag started.
 * @returns A normalized same-file range, or null outside the origin side/path.
 */
export function createRangeCommentTargetFromNode(
  node: Node | null,
  originTarget: DiffLineCommentTarget,
): DiffLineCommentTarget | null {
  const selectedLine = readSelectedLine(node, originTarget.side);
  if (selectedLine === null || selectedLine.path !== originTarget.sidePath) {
    return null;
  }

  const line = Math.min(originTarget.line, selectedLine.line);
  const endLine = Math.max(originTarget.line, selectedLine.line);
  return {
    ...originTarget,
    key: `${originTarget.side}:${originTarget.sidePath}:${endLine}`,
    line,
    endLine: line === endLine ? undefined : endLine,
  };
}

/**
 * @param root - Viewer document containing currently rendered line elements.
 * @param target - Current drag range.
 * @returns Rendered same-side line elements covered by the range.
 */
export function findRangeCommentPreviewElements(
  root: ParentNode,
  target: DiffLineCommentTarget,
): readonly HTMLElement[] {
  const endLine = target.endLine ?? target.line;
  return Array.from(
    root.querySelectorAll<HTMLElement>(
      '[data-diff-comment-line-container="true"]',
    ),
  ).filter((element) => {
    const path = element.getAttribute(`data-diff-comment-${target.side}-path`);
    const line = Number(
      element.getAttribute(`data-diff-comment-${target.side}-line`),
    );
    return (
      path === target.sidePath &&
      Number.isSafeInteger(line) &&
      line >= target.line &&
      line <= endLine
    );
  });
}

function readSelectedLine(
  node: Node | null,
  side: DiffLineCommentTarget["side"],
): Readonly<{ path: string; line: number }> | null {
  const element = getElement(node)?.closest<HTMLElement>(
    '[data-diff-comment-line-container="true"]',
  );
  if (element === null || element === undefined) {
    return null;
  }

  const path = element.getAttribute(`data-diff-comment-${side}-path`);
  const line = Number(element.getAttribute(`data-diff-comment-${side}-line`));
  if (path === null || !Number.isSafeInteger(line) || line < 1) {
    return null;
  }

  return { path, line };
}

function getElement(node: Node | null): Element | null {
  if (node instanceof Element) {
    return node;
  }
  return node?.parentElement ?? null;
}
