import { ZoomIn, ZoomOut } from "lucide-react";

import { uiText } from "@/utils/uiText";

export type HtmlZoomControlProps = Readonly<{
  zoomPercentLabel: string;
  canDecrease: boolean;
  canIncrease: boolean;
  /** Decreases the HTML preview zoom by one step. */
  onDecrease: () => void;
  /** Increases the HTML preview zoom by one step. */
  onIncrease: () => void;
}>;

/** @returns Zoom controls for sandboxed HTML document previews. */
export function HtmlZoomControl({
  zoomPercentLabel,
  canDecrease,
  canIncrease,
  onDecrease,
  onIncrease,
}: HtmlZoomControlProps) {
  return (
    <div
      className="html-zoom-control"
      aria-label={uiText.markdown.htmlZoomControls}
    >
      <button
        className="icon-button"
        type="button"
        aria-label={uiText.markdown.decreaseHtmlZoom}
        title={uiText.markdown.decreaseHtmlZoom}
        disabled={!canDecrease}
        onClick={onDecrease}
      >
        <ZoomOut aria-hidden="true" size={15} />
      </button>
      <output
        className="html-zoom-control__value"
        aria-label={uiText.markdown.htmlZoomPercent}
      >
        {zoomPercentLabel}
      </output>
      <button
        className="icon-button"
        type="button"
        aria-label={uiText.markdown.increaseHtmlZoom}
        title={uiText.markdown.increaseHtmlZoom}
        disabled={!canIncrease}
        onClick={onIncrease}
      >
        <ZoomIn aria-hidden="true" size={15} />
      </button>
    </div>
  );
}
