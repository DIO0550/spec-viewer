import { useCallback, useEffect, useMemo, useState } from "react";

import { readStorageValue, writeStorageValue } from "@/lib/storage";

const SidebarWidthStorageKey = "spec-reviewer.comment-sidebar-width";
const DefaultSidebarWidth = 300;
const MinSidebarWidth = 280;
const MaxSidebarWidth = 560;
const ViewportWidthRatio = 0.45;

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
    readStoredSidebarWidth(viewportWidth),
  );
  const constraints = useMemo(
    () => createSidebarWidthConstraints(viewportWidth),
    [viewportWidth],
  );

  useEffect(() => {
    const updateViewportWidth = (): void => {
      setViewportWidth(readViewportWidth());
    };

    window.addEventListener("resize", updateViewportWidth);

    return () => {
      window.removeEventListener("resize", updateViewportWidth);
    };
  }, []);

  useEffect(() => {
    setSidebarWidth((currentWidth) =>
      clampSidebarWidth(currentWidth, constraints),
    );
  }, [constraints]);

  useEffect(() => {
    writeStorageValue(SidebarWidthStorageKey, String(sidebarWidth));
  }, [sidebarWidth]);

  const resizeSidebarTo = useCallback(
    (width: number): void => {
      setSidebarWidth(clampSidebarWidth(width, constraints));
    },
    [constraints],
  );

  const resizeSidebarBy = useCallback(
    (delta: number): void => {
      setSidebarWidth((currentWidth) =>
        clampSidebarWidth(currentWidth + delta, constraints),
      );
    },
    [constraints],
  );

  const resetSidebarWidth = useCallback((): void => {
    setSidebarWidth(clampSidebarWidth(DefaultSidebarWidth, constraints));
  }, [constraints]);

  return {
    sidebarWidth,
    minSidebarWidth: constraints.min,
    maxSidebarWidth: constraints.max,
    resizeSidebarTo,
    resizeSidebarBy,
    resetSidebarWidth,
  };
}

type SidebarWidthConstraints = Readonly<{
  min: number;
  max: number;
}>;

/** @returns Sidebar width constraints for the current viewport. */
function createSidebarWidthConstraints(
  viewportWidth: number,
): SidebarWidthConstraints {
  const viewportMaxWidth = Math.floor(viewportWidth * ViewportWidthRatio);
  const max = Math.max(
    MinSidebarWidth,
    Math.min(MaxSidebarWidth, viewportMaxWidth),
  );

  return {
    min: MinSidebarWidth,
    max,
  };
}

/** @returns Width clamped to the given sidebar constraints. */
function clampSidebarWidth(
  width: number,
  constraints: SidebarWidthConstraints,
): number {
  if (!Number.isFinite(width)) {
    return DefaultSidebarWidth;
  }

  return Math.min(
    constraints.max,
    Math.max(constraints.min, Math.round(width)),
  );
}

/**
 * @param viewportWidth - Current viewport width in pixels.
 * @returns Stored sidebar width constrained to the current viewport.
 */
function readStoredSidebarWidth(viewportWidth: number): number {
  const constraints = createSidebarWidthConstraints(viewportWidth);
  const storedWidth = readStorageValue(SidebarWidthStorageKey);
  const parsedWidth = Number.parseInt(storedWidth ?? "", 10);

  return clampSidebarWidth(parsedWidth, constraints);
}

/** @returns Current viewport width with a desktop fallback for non-browser tests. */
function readViewportWidth(): number {
  if (typeof window === "undefined") {
    return 1440;
  }

  return window.innerWidth;
}
