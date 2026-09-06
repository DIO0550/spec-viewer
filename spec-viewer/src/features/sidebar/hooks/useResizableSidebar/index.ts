import { useCallback, useEffect, useMemo, useState } from "react";

import { SidebarWidth } from "@/domains/sidebarWidth";
import {
  readStoredSidebarWidth,
  writeStoredSidebarWidth,
} from "@/lib/storage/sidebar";
import { readViewportWidth, subscribeViewportWidth } from "@/lib/viewport";

type UseResizableSidebarResult = Readonly<{
  sidebarWidth: number;
  minSidebarWidth: number;
  maxSidebarWidth: number;
  /**
   * Sets the sidebar to an absolute width.
   * @param width - Target width in pixels.
   */
  resizeSidebarTo: (width: number) => void;
  /**
   * Adjusts the sidebar width by a relative delta.
   * @param delta - Width change in pixels.
   */
  resizeSidebarBy: (delta: number) => void;
  /** Resets the sidebar to its default width. */
  resetSidebarWidth: () => void;
}>;

/** @returns Right comment sidebar width persisted in browser storage. */
export function useResizableSidebar(): UseResizableSidebarResult {
  const [viewportWidth, setViewportWidth] = useState(readViewportWidth);
  const [sidebarWidth, setSidebarWidth] = useState(() =>
    SidebarWidth.fromNumber(
      readStoredSidebarWidth(),
      SidebarWidth.constraints(viewportWidth),
    ),
  );
  const constraints = useMemo(
    () => SidebarWidth.constraints(viewportWidth),
    [viewportWidth],
  );

  useEffect(() => subscribeViewportWidth(setViewportWidth), []);

  useEffect(() => {
    setSidebarWidth((currentWidth) =>
      SidebarWidth.fromNumber(currentWidth, constraints),
    );
  }, [constraints]);

  useEffect(() => {
    writeStoredSidebarWidth(SidebarWidth.toNumber(sidebarWidth));
  }, [sidebarWidth]);

  const resizeSidebarTo = useCallback(
    (width: number): void => {
      setSidebarWidth(SidebarWidth.fromNumber(width, constraints));
    },
    [constraints],
  );

  const resizeSidebarBy = useCallback(
    (delta: number): void => {
      setSidebarWidth((currentWidth) =>
        SidebarWidth.fromNumber(currentWidth + delta, constraints),
      );
    },
    [constraints],
  );

  const resetSidebarWidth = useCallback((): void => {
    setSidebarWidth(
      SidebarWidth.fromNumber(SidebarWidth.defaultValue, constraints),
    );
  }, [constraints]);

  return {
    sidebarWidth: SidebarWidth.toNumber(sidebarWidth),
    minSidebarWidth: constraints.min,
    maxSidebarWidth: constraints.max,
    resizeSidebarTo,
    resizeSidebarBy,
    resetSidebarWidth,
  };
}
