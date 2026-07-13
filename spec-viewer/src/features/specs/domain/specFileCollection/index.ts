import type { SpecFile, SpecFileKey } from "@/features/specs/domain/specFile";

export type SpecFileCollection = readonly SpecFile[];
export type SpecFileNavigationDirection = "next" | "previous";

export const SpecFileCollection = {
  /**
   * @param files - Files in backend-defined logical tab order.
   * @returns An immutable collection preserving the supplied logical order.
   */
  create(files: readonly SpecFile[]): SpecFileCollection {
    return [...files];
  },

  /**
   * @param files - Files in logical tab order.
   * @param currentKey - Currently selected key, if any.
   * @param direction - Navigation direction.
   * @returns The adjacent file key with wraparound, or null for an empty collection.
   */
  adjacentKey(
    files: SpecFileCollection,
    currentKey: SpecFileKey | null,
    direction: SpecFileNavigationDirection,
  ): SpecFileKey | null {
    if (files.length === 0) {
      return null;
    }

    const currentIndex = files.findIndex((file) => file.key === currentKey);
    const selectedIndex = currentIndex < 0 ? 0 : currentIndex;
    const offset = direction === "next" ? 1 : -1;
    const nextIndex = (selectedIndex + offset + files.length) % files.length;

    return files[nextIndex]?.key ?? null;
  },
} as const;
