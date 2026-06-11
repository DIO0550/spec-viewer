import { HtmlZoom } from "@/features/specs/domain/htmlZoom";

export type CreateHtmlPreviewDocumentInput = Readonly<{
  contents: string;
  sourcePath: string;
  zoomPercent: number;
}>;

export const HtmlPreviewDocument = {
  /**
   * @param input - Raw HTML contents, source path, and zoom percentage
   * @returns HTML contents with viewer-controlled viewport and zoom styles.
   */
  create({
    contents,
    sourcePath,
    zoomPercent,
  }: CreateHtmlPreviewDocumentInput): string {
    const normalizedContents = HtmlPreviewDocument.rewriteSameDocumentLinks(
      HtmlPreviewDocument.removeBaseElements(contents),
      sourcePath,
    );
    const previewHead = HtmlPreviewDocument.createHead(zoomPercent);

    if (/<\/head>/i.test(normalizedContents)) {
      return normalizedContents.replace(/<\/head>/i, `${previewHead}</head>`);
    }

    if (/<html(?:\s[^>]*)?>/i.test(normalizedContents)) {
      return normalizedContents.replace(
        /<html(?:\s[^>]*)?>/i,
        (htmlTag) => `${htmlTag}<head>${previewHead}</head>`,
      );
    }

    return [
      "<!doctype html>",
      "<html>",
      "<head>",
      previewHead,
      "</head>",
      "<body>",
      normalizedContents,
      "</body>",
      "</html>",
    ].join("");
  },
  /**
   * @param contents - Raw HTML contents
   * @returns HTML contents with document-provided base tags removed.
   */
  removeBaseElements(contents: string): string {
    return contents.replace(/<base\b[^>]*>/gi, "");
  },
  /**
   * @param contents - Raw HTML contents
   * @param sourcePath - Path of the previewed document
   * @returns HTML contents with same-file hash links rewritten for srcdoc navigation.
   */
  rewriteSameDocumentLinks(contents: string, sourcePath: string): string {
    const sourceFileName = HtmlPreviewDocument.getPathFileName(sourcePath);

    return contents.replace(
      /\bhref=(["'])([^"']+)["']/gi,
      (attribute, quote: string, href: string) => {
        const hashIndex = href.indexOf("#");

        if (hashIndex < 0) {
          return attribute;
        }

        const hrefPath = href.slice(0, hashIndex);
        const hrefHash = href.slice(hashIndex);

        if (
          !HtmlPreviewDocument.isSameDocumentLinkPath(hrefPath, sourceFileName)
        ) {
          return attribute;
        }

        return `href=${quote}${hrefHash}${quote}`;
      },
    );
  },
  /**
   * @param hrefPath - Path part of a link href
   * @param sourceFileName - File name of the previewed document
   * @returns Whether a link path points at the current srcdoc document.
   */
  isSameDocumentLinkPath(hrefPath: string, sourceFileName: string): boolean {
    if (hrefPath.length === 0) {
      return true;
    }

    if (hrefPath === "." || hrefPath === "./") {
      return true;
    }

    return HtmlPreviewDocument.getPathFileName(hrefPath) === sourceFileName;
  },
  /**
   * @param path - Slash-delimited path with optional query or hash
   * @returns The final path segment from a slash-delimited path.
   */
  getPathFileName(path: string): string {
    const normalizedPath = path.split(/[?#]/, 1)[0] ?? "";
    const pathSegments = normalizedPath.split("/").filter(Boolean);

    return pathSegments[pathSegments.length - 1] ?? normalizedPath;
  },
  /**
   * @param zoomPercent - Current zoom percentage
   * @returns Meta and CSS that make arbitrary HTML previews fit the iframe.
   */
  createHead(zoomPercent: number): string {
    return [
      '<meta name="viewport" content="width=device-width, initial-scale=1" />',
      '<base href="about:srcdoc" />',
      '<style id="spec-viewer-html-preview-style">',
      ":root {",
      `  --spec-viewer-html-zoom: ${HtmlZoom.formatScale(zoomPercent)};`,
      "}",
      "* { box-sizing: border-box; }",
      "html { width: 100%; min-width: 0; }",
      "body { width: 100%; max-width: 100%; min-width: 0; margin: 0; overflow-wrap: anywhere; }",
      "img, video, canvas, svg { max-width: 100%; height: auto; }",
      "iframe, object, embed { max-width: 100%; }",
      "pre { max-width: 100%; overflow: auto; white-space: pre-wrap; }",
      "table { max-width: 100%; }",
      "@supports (zoom: 1) {",
      "  body { zoom: var(--spec-viewer-html-zoom); }",
      "}",
      "@supports not (zoom: 1) {",
      "  body {",
      "    width: calc(100% / var(--spec-viewer-html-zoom));",
      "    max-width: calc(100% / var(--spec-viewer-html-zoom));",
      "    transform: scale(var(--spec-viewer-html-zoom));",
      "    transform-origin: top left;",
      "  }",
      "}",
      "</style>",
    ].join("");
  },
} as const;
