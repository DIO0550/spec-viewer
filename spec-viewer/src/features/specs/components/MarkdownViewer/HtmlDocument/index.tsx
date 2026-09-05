import { uiText } from "@/utils/uiText";

import {
  createHtmlPreviewDocument,
  createHtmlPreviewSandbox,
} from "./htmlPreviewDocument";

export type HtmlDocumentProps = Readonly<{
  contents: string;
  path: string;
  zoomPercent: number;
  searchQuery: string;
  activeSearchMatchIndex: number;
}>;

/** @returns Sandboxed HTML preview for non-Markdown spec files. */
export function HtmlDocument({
  contents,
  path,
  zoomPercent,
  searchQuery,
  activeSearchMatchIndex,
}: HtmlDocumentProps) {
  return (
    <iframe
      className="html-rendered"
      title={uiText.markdown.renderedHtmlDocument}
      sandbox={createHtmlPreviewSandbox(path)}
      srcDoc={createHtmlPreviewDocument({
        contents,
        sourcePath: path,
        zoomPercent,
        searchQuery,
        activeSearchMatchIndex,
      })}
    />
  );
}
