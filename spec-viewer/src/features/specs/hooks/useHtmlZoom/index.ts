import { useEffect, useState } from "react";

import { HtmlZoom } from "@/features/specs/domain/htmlZoom";

type UseHtmlZoomOptions = Readonly<{
  resetKey: string;
}>;

type UseHtmlZoomResult = Readonly<{
  zoomPercent: number;
  /** Steps the preview zoom down by one increment. */
  decrease: () => void;
  /** Steps the preview zoom up by one increment. */
  increase: () => void;
}>;

/**
 * Manages the HTML preview zoom level for the current document.
 *
 * @param options - Reset key identifying the displayed document
 * @returns The current zoom percentage and step controls.
 */
export function useHtmlZoom({
  resetKey,
}: UseHtmlZoomOptions): UseHtmlZoomResult {
  const [zoomPercent, setZoomPercent] = useState<number>(
    HtmlZoom.defaultPercent,
  );

  useEffect(() => {
    setZoomPercent(HtmlZoom.defaultPercent);
  }, [resetKey]);

  const decrease = (): void => {
    setZoomPercent((currentZoomPercent) =>
      HtmlZoom.decreasePercent(currentZoomPercent),
    );
  };

  const increase = (): void => {
    setZoomPercent((currentZoomPercent) =>
      HtmlZoom.increasePercent(currentZoomPercent),
    );
  };

  return { zoomPercent, decrease, increase };
}
