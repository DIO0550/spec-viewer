import { uiText } from "@/shared/lib/uiText";

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
  allowsScripts: boolean;
}>;

/** @returns Sandboxed HTML preview for non-Markdown spec files. */
export function HtmlDocument({
  contents,
  path,
  zoomPercent,
  searchQuery,
  activeSearchMatchIndex,
  allowsScripts,
}: HtmlDocumentProps) {
  return (
    <iframe
      className="html-rendered"
      title={uiText.markdown.renderedHtmlDocument}
      sandbox={createHtmlPreviewSandbox(allowsScripts)}
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
