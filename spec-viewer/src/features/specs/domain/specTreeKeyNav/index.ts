export type SpecTreeKeyNavInput = Readonly<{
  key: string;
  /** Visible item levels in document order (aria-level, 1-based). */
  levels: readonly number[];
  currentIndex: number;
}>;

export const SpecTreeKeyNav = {
  /**
   * @param input - Pressed key, visible item levels, and current focus index
   * @returns The next tree item index for supported navigation keys.
   */
  nextIndex({ key, levels, currentIndex }: SpecTreeKeyNavInput): number | null {
    if (currentIndex < 0 || currentIndex >= levels.length) {
      return null;
    }

    if (key === "ArrowDown") {
      return Math.min(currentIndex + 1, levels.length - 1);
    }

    if (key === "ArrowUp") {
      return Math.max(currentIndex - 1, 0);
    }

    if (key === "Home") {
      return 0;
    }

    if (key === "End") {
      return levels.length - 1;
    }

    if (key === "ArrowRight") {
      return firstChildIndex(levels, currentIndex);
    }

    if (key === "ArrowLeft") {
      return parentIndex(levels, currentIndex);
    }

    return null;
  },
  /**
   * @param input - Pressed key and the expansion state of the focused item
   * @returns True when the key should toggle the focused item expansion.
   */
  shouldToggleExpansion({
    key,
    hasChildren,
    isExpanded,
  }: Readonly<{
    key: string;
    hasChildren: boolean;
    isExpanded: boolean;
  }>): boolean {
    if (key === "ArrowRight") {
      return hasChildren && !isExpanded;
    }

    if (key === "ArrowLeft") {
      return hasChildren && isExpanded;
    }

    return false;
  },
} as const;

/**
 * @param levels - Visible item levels in document order
 * @param currentIndex - Current focus index
 * @returns The first visible child item index, or null when the item is a leaf.
 */
function firstChildIndex(
  levels: readonly number[],
  currentIndex: number,
): number | null {
  const nextIndex = currentIndex + 1;
  const nextLevel = levels[nextIndex];

  if (nextLevel === undefined) {
    return null;
  }

  const currentLevel = levels[currentIndex] ?? 1;

  return nextLevel > currentLevel ? nextIndex : null;
}

/**
 * @param levels - Visible item levels in document order
 * @param currentIndex - Current focus index
 * @returns The closest visible parent item index, or null for root items.
 */
function parentIndex(
  levels: readonly number[],
  currentIndex: number,
): number | null {
  const currentLevel = levels[currentIndex] ?? 1;

  if (currentLevel <= 1) {
    return null;
  }

  for (let index = currentIndex - 1; index >= 0; index -= 1) {
    const level = levels[index] ?? 1;

    if (level < currentLevel) {
      return index;
    }
  }

  return null;
}
