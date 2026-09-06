import { useCallback, useEffect, useMemo, useState } from "react";

const leftNavigationWidthStorageKey = "spec-reviewer.left-navigation-width";
const defaultLeftNavigationWidth = 240;
const minLeftNavigationWidth = 216;
const maxLeftNavigationWidth = 420;
const viewportWidthRatio = 0.42;

type UseResizableLeftNavigationResult = Readonly<{
  leftNavigationWidth: number;
  minLeftNavigationWidth: number;
  maxLeftNavigationWidth: number;
  /**
   * Sets the left navigation to an absolute width.
   * @param width - Target width in pixels.
   */
  resizeLeftNavigationTo: (width: number) => void;
  /**
   * Adjusts the left navigation width by a relative delta.
   * @param delta - Width change in pixels.
   */
  resizeLeftNavigationBy: (delta: number) => void;
  /** Resets the left navigation to its default width. */
  resetLeftNavigationWidth: () => void;
}>;

/** @returns Left spec navigation width persisted in browser storage. */
export function useResizableLeftNavigation(): UseResizableLeftNavigationResult {
  const [viewportWidth, setViewportWidth] = useState(readViewportWidth);
  const [leftNavigationWidth, setLeftNavigationWidth] = useState(() =>
    readStoredLeftNavigationWidth(viewportWidth),
  );
  const constraints = useMemo(
    () => createLeftNavigationWidthConstraints(viewportWidth),
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
    setLeftNavigationWidth((currentWidth) =>
      clampLeftNavigationWidth(currentWidth, constraints),
    );
  }, [constraints]);

  useEffect(() => {
    writeStoredLeftNavigationWidth(leftNavigationWidth);
  }, [leftNavigationWidth]);

  const resizeLeftNavigationTo = useCallback(
    (width: number): void => {
      setLeftNavigationWidth(clampLeftNavigationWidth(width, constraints));
    },
    [constraints],
  );

  const resizeLeftNavigationBy = useCallback(
    (delta: number): void => {
      setLeftNavigationWidth((currentWidth) =>
        clampLeftNavigationWidth(currentWidth + delta, constraints),
      );
    },
    [constraints],
  );

  const resetLeftNavigationWidth = useCallback((): void => {
    setLeftNavigationWidth(
      clampLeftNavigationWidth(defaultLeftNavigationWidth, constraints),
    );
  }, [constraints]);

  return {
    leftNavigationWidth,
    minLeftNavigationWidth: constraints.min,
    maxLeftNavigationWidth: constraints.max,
    resizeLeftNavigationTo,
    resizeLeftNavigationBy,
    resetLeftNavigationWidth,
  };
}

type LeftNavigationWidthConstraints = Readonly<{
  min: number;
  max: number;
}>;

/** @returns Left navigation width constraints for the current viewport. */
function createLeftNavigationWidthConstraints(
  viewportWidth: number,
): LeftNavigationWidthConstraints {
  const viewportMaxWidth = Math.floor(viewportWidth * viewportWidthRatio);
  const max = Math.max(
    minLeftNavigationWidth,
    Math.min(maxLeftNavigationWidth, viewportMaxWidth),
  );

  return {
    min: minLeftNavigationWidth,
    max,
  };
}

/** @returns Width clamped to the given left navigation constraints. */
function clampLeftNavigationWidth(
  width: number,
  constraints: LeftNavigationWidthConstraints,
): number {
  if (!Number.isFinite(width)) {
    return clampDefaultLeftNavigationWidth(constraints);
  }

  return Math.min(
    constraints.max,
    Math.max(constraints.min, Math.round(width)),
  );
}

/**
 * @param viewportWidth - Current viewport width in pixels.
 * @returns Stored left navigation width or a sane default for the viewport.
 */
function readStoredLeftNavigationWidth(viewportWidth: number): number {
  const constraints = createLeftNavigationWidthConstraints(viewportWidth);

  if (typeof window === "undefined") {
    return clampDefaultLeftNavigationWidth(constraints);
  }

  try {
    const storedWidth = window.localStorage.getItem(
      leftNavigationWidthStorageKey,
    );
    const parsedWidth = Number.parseInt(storedWidth ?? "", 10);

    if (isWidthWithinConstraints(parsedWidth, constraints)) {
      return parsedWidth;
    }

    return clampDefaultLeftNavigationWidth(constraints);
  } catch {
    return clampDefaultLeftNavigationWidth(constraints);
  }
}

/**
 * Persists the left navigation width when storage is available.
 * @param leftNavigationWidth - Width in pixels to persist.
 */
function writeStoredLeftNavigationWidth(leftNavigationWidth: number): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      leftNavigationWidthStorageKey,
      String(leftNavigationWidth),
    );
  } catch {
    return;
  }
}

/** @returns Whether the width is finite and usable for the current viewport. */
function isWidthWithinConstraints(
  width: number,
  constraints: LeftNavigationWidthConstraints,
): boolean {
  return (
    Number.isFinite(width) &&
    width >= constraints.min &&
    width <= constraints.max
  );
}

/** @returns The default left navigation width constrained to the viewport. */
function clampDefaultLeftNavigationWidth(
  constraints: LeftNavigationWidthConstraints,
): number {
  return Math.min(
    constraints.max,
    Math.max(constraints.min, defaultLeftNavigationWidth),
  );
}

/** @returns Current viewport width with a desktop fallback for non-browser tests. */
function readViewportWidth(): number {
  if (typeof window === "undefined") {
    return 1440;
  }

  return window.innerWidth;
}
