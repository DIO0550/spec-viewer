const NonBrowserViewportWidth = 1440;

/** @returns Current viewport pixels, or a desktop fallback outside the browser. */
export function readViewportWidth(): number {
  if (typeof window === "undefined") {
    return NonBrowserViewportWidth;
  }

  return window.innerWidth;
}

/**
 * @param onWidthChange - Receives the current width on resize, without an initial notification.
 * @returns Cleanup for this subscription, or a no-op when there is no browser.
 */
export function subscribeViewportWidth(
  onWidthChange: (width: number) => void,
): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  const target = window;
  const onResize = (): void => onWidthChange(target.innerWidth);
  target.addEventListener("resize", onResize);

  return () => target.removeEventListener("resize", onResize);
}
