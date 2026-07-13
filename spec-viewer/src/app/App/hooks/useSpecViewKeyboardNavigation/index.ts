import { useCallback } from "react";
import type { NavigationDirection } from "@/app/App/hooks/types";
import { useKeyboardShortcuts } from "@/features/preferences";
import {
  SpecFileCollection,
  type SpecFileCollection as SpecFileCollectionType,
  type SpecFileKey,
} from "@/features/specs";

/** selectedSpec のうち本フックが使う形だけの狭い構造的型。 */
export type NavigableSpec = Readonly<{
  files: SpecFileCollectionType;
}>;

export type UseSpecViewKeyboardNavigationOptions = Readonly<{
  isCurrentViewLoading: boolean;
  selectedSpec: NavigableSpec | null;
  selectedFileKey: SpecFileKey | null;
  /** Selects a spec file. @param fileKey - Key of the file to select. */
  selectFileKey: (fileKey: SpecFileKey) => Promise<unknown>;
  /** Selects the adjacent comment. @param direction - Navigation direction. */
  selectAdjacentComment: (direction: NavigationDirection) => boolean;
}>;

/**
 * Binds global keyboard shortcuts to adjacent file/comment navigation.
 *
 * @param options - Current selection, guard flag, and navigation callbacks.
 */
export function useSpecViewKeyboardNavigation(
  options: UseSpecViewKeyboardNavigationOptions,
): void {
  const {
    isCurrentViewLoading,
    selectedSpec,
    selectedFileKey,
    selectFileKey,
    selectAdjacentComment,
  } = options;

  const selectAdjacentFile = useCallback(
    (direction: NavigationDirection): boolean => {
      if (isCurrentViewLoading || selectedSpec === null) {
        return false;
      }

      const nextFileKey = SpecFileCollection.adjacentKey(
        selectedSpec.files,
        selectedFileKey,
        direction,
      );

      if (nextFileKey === null) {
        return false;
      }

      void selectFileKey(nextFileKey);
      return true;
    },
    [isCurrentViewLoading, selectFileKey, selectedFileKey, selectedSpec],
  );

  useKeyboardShortcuts({
    /** Navigates to the next file. */
    onNextFile: () => selectAdjacentFile("next"),
    /** Navigates to the previous file. */
    onPreviousFile: () => selectAdjacentFile("previous"),
    /** Navigates to the next comment. */
    onNextComment: () => selectAdjacentComment("next"),
    /** Navigates to the previous comment. */
    onPreviousComment: () => selectAdjacentComment("previous"),
  });
}
