import { highlightHtmlDocument } from "@/lib/htmlDocumentSearch";

export const HTML_ZOOM_DEFAULT_PERCENT = 100;
export const HTML_ZOOM_MIN_PERCENT = 50;
export const HTML_ZOOM_MAX_PERCENT = 160;
export const HTML_ZOOM_STEP_PERCENT = 10;

const HTML_PREVIEW_DEFAULT_SANDBOX = "";
const HTML_PREVIEW_SCRIPT_SANDBOX = "allow-scripts";

export type CreateHtmlPreviewDocumentInput = Readonly<{
  contents: string;
  sourcePath: string;
  zoomPercent: number;
  searchQuery: string;
  activeSearchMatchIndex: number;
}>;

/**
 * @param allowsScripts - Explicit script capability from the document boundary.
 * @returns Sandbox policy for the HTML preview iframe.
 */
export function createHtmlPreviewSandbox(allowsScripts: boolean): string {
  if (allowsScripts) {
    return HTML_PREVIEW_SCRIPT_SANDBOX;
  }

  return HTML_PREVIEW_DEFAULT_SANDBOX;
}

/**
 * @param input - Raw HTML contents and viewer state used to build the iframe srcdoc.
 * @returns HTML contents with search highlights, normalized links, and viewer-controlled head markup.
 */
export function createHtmlPreviewDocument({
  contents,
  sourcePath,
  zoomPercent,
  searchQuery,
  activeSearchMatchIndex,
}: CreateHtmlPreviewDocumentInput): string {
  const highlightedContents = highlightHtmlDocument(
    contents,
    searchQuery,
    activeSearchMatchIndex,
  );
  const normalizedContents = rewriteSameDocumentHtmlLinks(
    removeHtmlBaseElements(highlightedContents),
    sourcePath,
  );
  const previewHead = createHtmlPreviewHead(zoomPercent);

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
}

/**
 * @param contents - The raw HTML document contents.
 * @returns HTML contents with document-provided base tags removed.
 */
export function removeHtmlBaseElements(contents: string): string {
  return contents.replace(/<base\b[^>]*>/gi, "");
}

/**
 * @param contents - HTML contents to normalize.
 * @param sourcePath - The source path of the HTML document.
 * @returns HTML contents with same-file hash links rewritten for srcdoc navigation.
 */
export function rewriteSameDocumentHtmlLinks(
  contents: string,
  sourcePath: string,
): string {
  const sourceFileName = getPathFileName(sourcePath);

  return contents.replace(
    /(^|\s)href=(["'])([^"']+)["']/gi,
    (attribute, prefix: string, quote: string, href: string) => {
      const hashIndex = href.indexOf("#");

      if (hashIndex < 0) {
        return attribute;
      }

      const hrefPath = href.slice(0, hashIndex);
      const hrefHash = href.slice(hashIndex);

      if (!isSameDocumentHtmlLinkPath(hrefPath, sourceFileName)) {
        return attribute;
      }

      return `${prefix}href=${quote}${hrefHash}${quote}`;
    },
  );
}

/**
 * @param hrefPath - Link path before the hash fragment.
 * @param sourceFileName - The current HTML document file name.
 * @returns Whether a link path points at the current srcdoc document.
 */
function isSameDocumentHtmlLinkPath(
  hrefPath: string,
  sourceFileName: string,
): boolean {
  if (hrefPath.length === 0) {
    return true;
  }

  if (hrefPath === "." || hrefPath === "./") {
    return true;
  }

  return getPathFileName(hrefPath) === sourceFileName;
}

/**
 * @param path - The slash-delimited path to inspect.
 * @returns The final path segment from a slash-delimited path.
 */
function getPathFileName(path: string): string {
  const normalizedPath = path.split(/[?#]/, 1)[0] ?? "";
  const pathSegments = normalizedPath.split("/").filter(Boolean);

  return pathSegments[pathSegments.length - 1] ?? normalizedPath;
}

/**
 * @param zoomPercent - The current HTML preview zoom percentage.
 * @returns Meta and CSS that make arbitrary HTML previews fit the iframe.
 */
export function createHtmlPreviewHead(zoomPercent: number): string {
  const zoomScale = zoomPercent / 100;

  return [
    '<meta name="viewport" content="width=device-width, initial-scale=1" />',
    '<base href="about:srcdoc" />',
    '<style id="spec-viewer-html-preview-style">',
    ":root {",
    `  --spec-viewer-html-zoom: ${formatHtmlZoomScale(zoomScale)};`,
    "}",
    "* { box-sizing: border-box; }",
    "html { width: 100%; min-width: 0; }",
    "body { width: 100%; max-width: 100%; min-width: 0; margin: 0; overflow-wrap: anywhere; }",
    "img, video, canvas, svg { max-width: 100%; height: auto; }",
    "iframe, object, embed { max-width: 100%; }",
    "pre { max-width: 100%; overflow: auto; white-space: pre-wrap; }",
    "table { max-width: 100%; }",
    "[data-document-search-match] { background: #fde68a; color: inherit; padding: 0 0.08em; border-radius: 2px; }",
    '[data-document-search-match-active="true"] { background: #f59e0b; outline: 2px solid #b45309; }',
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
}

/**
 * @param zoomPercent - The requested zoom percentage.
 * @returns A zoom percentage clamped to the supported HTML preview range.
 */
export function clampHtmlZoomPercent(zoomPercent: number): number {
  return Math.min(
    HTML_ZOOM_MAX_PERCENT,
    Math.max(HTML_ZOOM_MIN_PERCENT, zoomPercent),
  );
}

/**
 * @param zoomPercent - The zoom percentage to format.
 * @returns A user-facing zoom percentage label.
 */
export function formatHtmlZoomPercent(zoomPercent: number): string {
  return `${zoomPercent}%`;
}

/**
 * @param zoomScale - The zoom scale factor to format.
 * @returns A compact CSS number for the HTML preview zoom scale.
 */
function formatHtmlZoomScale(zoomScale: number): string {
  return Number(zoomScale.toFixed(2)).toString();
}
