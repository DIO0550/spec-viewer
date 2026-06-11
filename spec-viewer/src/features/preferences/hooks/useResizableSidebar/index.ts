import { useCallback, useEffect, useMemo, useState } from "react";

const sidebarWidthStorageKey = "spec-reviewer.comment-sidebar-width";
const defaultSidebarWidth = 360;
const minSidebarWidth = 280;
const maxSidebarWidth = 560;
const viewportWidthRatio = 0.45;

type UseResizableSidebarResult = Readonly<{
  sidebarWidth: number;
  minSidebarWidth: number;
  maxSidebarWidth: number;
  /** @param width - Absolute width in pixels to apply within constraints */
  resizeSidebarTo: (width: number) => void;
  /** @param delta - Width change in pixels to apply within constraints */
  resizeSidebarBy: (delta: number) => void;
  /** Resets the sidebar width to its default. */
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
    writeStoredSidebarWidth(sidebarWidth);
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
    setSidebarWidth(clampSidebarWidth(defaultSidebarWidth, constraints));
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
  const viewportMaxWidth = Math.floor(viewportWidth * viewportWidthRatio);
  const max = Math.max(
    minSidebarWidth,
    Math.min(maxSidebarWidth, viewportMaxWidth),
  );

  return {
    min: minSidebarWidth,
    max,
  };
}

/** @returns Width clamped to the given sidebar constraints. */
function clampSidebarWidth(
  width: number,
  constraints: SidebarWidthConstraints,
): number {
  if (!Number.isFinite(width)) {
    return defaultSidebarWidth;
  }

  return Math.min(
    constraints.max,
    Math.max(constraints.min, Math.round(width)),
  );
}

/**
 * @param viewportWidth - Current viewport width in pixels
 * @returns Stored sidebar width constrained to the current viewport.
 */
function readStoredSidebarWidth(viewportWidth: number): number {
  const constraints = createSidebarWidthConstraints(viewportWidth);

  if (typeof window === "undefined") {
    return clampSidebarWidth(defaultSidebarWidth, constraints);
  }

  try {
    const storedWidth = window.localStorage.getItem(sidebarWidthStorageKey);
    const parsedWidth = Number.parseInt(storedWidth ?? "", 10);

    return clampSidebarWidth(parsedWidth, constraints);
  } catch {
    return clampSidebarWidth(defaultSidebarWidth, constraints);
  }
}

/**
 * Persists the sidebar width when storage is available.
 * @param sidebarWidth - Width in pixels to store
 */
function writeStoredSidebarWidth(sidebarWidth: number): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(sidebarWidthStorageKey, String(sidebarWidth));
  } catch {
    return;
  }
}

/** @returns Current viewport width with a desktop fallback for non-browser tests. */
function readViewportWidth(): number {
  if (typeof window === "undefined") {
    return 1440;
  }

  return window.innerWidth;
}
