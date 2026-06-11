import { ZoomIn, ZoomOut } from "lucide-react";

import { HtmlPreviewDocument } from "@/features/specs/domain/htmlPreviewDocument";
import { HtmlZoom } from "@/features/specs/domain/htmlZoom";
import { uiText } from "@/shared/lib/uiText";

type HtmlZoomControlProps = Readonly<{
  zoomPercent: number;
  /** Steps the preview zoom down by one increment. */
  onDecrease: () => void;
  /** Steps the preview zoom up by one increment. */
  onIncrease: () => void;
}>;

/** @returns Zoom controls for sandboxed HTML document previews. */
export function HtmlZoomControl({
  zoomPercent,
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
        disabled={zoomPercent <= HtmlZoom.minPercent}
        onClick={onDecrease}
      >
        <ZoomOut aria-hidden="true" size={15} />
      </button>
      <output
        className="html-zoom-control__value"
        aria-label={uiText.markdown.htmlZoomPercent}
      >
        {HtmlZoom.formatPercent(zoomPercent)}
      </output>
      <button
        className="icon-button"
        type="button"
        aria-label={uiText.markdown.increaseHtmlZoom}
        title={uiText.markdown.increaseHtmlZoom}
        disabled={zoomPercent >= HtmlZoom.maxPercent}
        onClick={onIncrease}
      >
        <ZoomIn aria-hidden="true" size={15} />
      </button>
    </div>
  );
}

type HtmlDocumentProps = Readonly<{
  contents: string;
  path: string;
  zoomPercent: number;
}>;

/** @returns Sandboxed HTML preview for non-Markdown spec files. */
export function HtmlDocument({
  contents,
  path,
  zoomPercent,
}: HtmlDocumentProps) {
  return (
    <iframe
      className="html-rendered"
      title={uiText.markdown.renderedHtmlDocument}
      sandbox=""
      srcDoc={HtmlPreviewDocument.create({
        contents,
        sourcePath: path,
        zoomPercent,
      })}
    />
  );
}
