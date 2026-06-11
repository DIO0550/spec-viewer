import type { SpecFile, SpecFileKey } from "@/features/specs/types/spec";

export type SpecFileNavigationDirection = "next" | "previous";

const FALLBACK_FILE_INDEX = 0;

/**
 * @param index - Candidate index that may step outside the list
 * @param count - Number of available items
 * @returns The index wrapped into the available range.
 */
function wrapIndex(index: number, count: number): number {
  return (index + count) % count;
}

type AdjacentFileKeyInput = Readonly<{
  files: readonly SpecFile[];
  selectedFileKey: SpecFileKey | null;
  direction: SpecFileNavigationDirection;
}>;

export const SpecFileNavigation = {
  /**
   * @param input - Spec files, current selection, and navigation direction
   * @returns The wrapped adjacent file key, or null when no files exist.
   */
  adjacentFileKey({
    files,
    selectedFileKey,
    direction,
  }: AdjacentFileKeyInput): SpecFileKey | null {
    if (files.length === 0) {
      return null;
    }

    const currentIndex = files.findIndex(
      (file) => file.key === selectedFileKey,
    );
    const selectedIndex = currentIndex < 0 ? FALLBACK_FILE_INDEX : currentIndex;
    const offset = direction === "next" ? 1 : -1;
    const nextIndex = wrapIndex(selectedIndex + offset, files.length);

    return files[nextIndex]?.key ?? null;
  },
} as const;
