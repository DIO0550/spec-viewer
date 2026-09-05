import { useCallback, useEffect, useState } from "react";

import {
  ViewerFontSize,
  type ViewerFontSize as ViewerFontSizeType,
} from "@/features/preferences/domain/viewerFontSize";
import { readStorageValue, writeStorageValue } from "@/lib/storage";
export type { ViewerFontSize } from "@/features/preferences/domain/viewerFontSize";

const viewerFontSizeStorageKey = "spec-reviewer.viewer-font-size";

type UseViewerFontSizePreferenceResult = Readonly<{
  viewerFontSize: ViewerFontSizeType;
  /**
   * @param value - Viewer font size to persist and apply.
   */
  setViewerFontSize: (value: ViewerFontSizeType) => void;
}>;

/** @returns Persisted font-size preference shared by Spec, Diff and Editor viewers. */
export function useViewerFontSizePreference(): UseViewerFontSizePreferenceResult {
  const [viewerFontSize, setViewerFontSizeState] = useState<ViewerFontSizeType>(
    () => ViewerFontSize.parse(readStorageValue(viewerFontSizeStorageKey)),
  );

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.dataset.viewerFontSize = viewerFontSize;
    }
    writeStorageValue(viewerFontSizeStorageKey, viewerFontSize);
  }, [viewerFontSize]);

  const setViewerFontSize = useCallback((value: ViewerFontSizeType): void => {
    setViewerFontSizeState(value);
  }, []);

  return {
    viewerFontSize,
    setViewerFontSize,
  };
}
