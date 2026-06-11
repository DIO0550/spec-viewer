const HTML_ZOOM_DEFAULT_PERCENT = 100;
const HTML_ZOOM_MIN_PERCENT = 50;
const HTML_ZOOM_MAX_PERCENT = 160;
const HTML_ZOOM_STEP_PERCENT = 10;
const HTML_ZOOM_PERCENT_BASE = 100;
const HTML_ZOOM_SCALE_FRACTION_DIGITS = 2;

export const HtmlZoom = {
  /** Default zoom percentage applied when a document is opened. */
  defaultPercent: HTML_ZOOM_DEFAULT_PERCENT,
  /** Smallest zoom percentage supported by the HTML preview. */
  minPercent: HTML_ZOOM_MIN_PERCENT,
  /** Largest zoom percentage supported by the HTML preview. */
  maxPercent: HTML_ZOOM_MAX_PERCENT,
  /**
   * @param zoomPercent - Requested zoom percentage
   * @returns A zoom percentage clamped to the supported HTML preview range.
   */
  clampPercent(zoomPercent: number): number {
    return Math.min(
      HTML_ZOOM_MAX_PERCENT,
      Math.max(HTML_ZOOM_MIN_PERCENT, zoomPercent),
    );
  },
  /**
   * @param zoomPercent - Current zoom percentage
   * @returns The next smaller zoom percentage within the supported range.
   */
  decreasePercent(zoomPercent: number): number {
    return HtmlZoom.clampPercent(zoomPercent - HTML_ZOOM_STEP_PERCENT);
  },
  /**
   * @param zoomPercent - Current zoom percentage
   * @returns The next larger zoom percentage within the supported range.
   */
  increasePercent(zoomPercent: number): number {
    return HtmlZoom.clampPercent(zoomPercent + HTML_ZOOM_STEP_PERCENT);
  },
  /**
   * @param zoomPercent - Current zoom percentage
   * @returns A user-facing zoom percentage label.
   */
  formatPercent(zoomPercent: number): string {
    return `${zoomPercent}%`;
  },
  /**
   * @param zoomPercent - Current zoom percentage
   * @returns A compact CSS number for the HTML preview zoom scale.
   */
  formatScale(zoomPercent: number): string {
    const zoomScale = zoomPercent / HTML_ZOOM_PERCENT_BASE;

    return Number(
      zoomScale.toFixed(HTML_ZOOM_SCALE_FRACTION_DIGITS),
    ).toString();
  },
} as const;
