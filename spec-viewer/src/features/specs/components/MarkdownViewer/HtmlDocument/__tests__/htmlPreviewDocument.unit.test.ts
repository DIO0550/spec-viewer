import { expect, test } from "vitest";

import {
  clampHtmlZoomPercent,
  createHtmlPreviewDocument,
  createHtmlPreviewHead,
  createHtmlPreviewSandbox,
  formatHtmlZoomPercent,
  isScriptEnabledHtmlPath,
  removeHtmlBaseElements,
  rewriteSameDocumentHtmlLinks,
} from "../htmlPreviewDocument";

test.each([
  ["docs/notes.html"],
  ["docs/requirements-copy.html"],
  ["docs/understanding-quiz-impl.md"],
  ["docs/test-cases-copy.html"],
])("createHtmlPreviewSandboxは%sでscriptを許可しない", (path) => {
  expect(createHtmlPreviewSandbox(path)).toBe("");
  expect(isScriptEnabledHtmlPath(path)).toBe(false);
});

test.each([
  ["docs/requirements.html"],
  ["docs/REQUIREMENTS.HTML"],
  ["docs/understanding-quiz-plan.html"],
  ["docs/UNDERSTANDING-QUIZ-IMPL.HTML?version=1#quiz"],
  ["docs/test-cases.html#cases"],
  ["docs/test-cases.html?version=1#cases"],
])("createHtmlPreviewSandboxは%sでscriptを許可する", (path) => {
  expect(createHtmlPreviewSandbox(path)).toBe("allow-scripts");
  expect(isScriptEnabledHtmlPath(path)).toBe(true);
});

test("removeHtmlBaseElementsは文書由来のbaseタグを除去する", () => {
  expect(
    removeHtmlBaseElements(
      '<html><head><base href="https://example.com/"><BASE target="_blank"></head><body>本文</body></html>',
    ),
  ).toBe("<html><head></head><body>本文</body></html>");
});

test.each([
  ['<a href="#overview">Overview</a>', '<a href="#overview">Overview</a>'],
  [
    '<a href="tasks.html#preview">Preview</a>',
    '<a href="#preview">Preview</a>',
  ],
  [
    "<a href='./tasks.html#preview'>Preview</a>",
    "<a href='#preview'>Preview</a>",
  ],
  ['<a href=".#local">Local</a>', '<a href="#local">Local</a>'],
  ['<a href="./#local">Local</a>', '<a href="#local">Local</a>'],
])("rewriteSameDocumentHtmlLinksは同一文書リンクをhashだけにする", (input, expected) => {
  expect(
    rewriteSameDocumentHtmlLinks(input, "/workspace/docs/tasks.html"),
  ).toBe(expected);
});

test.each([
  ['<a href="other.html#preview">Other</a>'],
  ['<a href="https://example.com/other.html#preview">External</a>'],
  ['<a href="tasks.html">No hash</a>'],
  ['<a data-href="tasks.html#preview">Preview</a>'],
])("rewriteSameDocumentHtmlLinksは対象外hrefを変更しない", (input) => {
  expect(
    rewriteSameDocumentHtmlLinks(input, "/workspace/docs/tasks.html"),
  ).toBe(input);
});

test("createHtmlPreviewDocumentは検索highlightとviewer管理headを注入する", () => {
  const preview = createHtmlPreviewDocument({
    contents: [
      '<html><head><base href="https://example.com/"></head><body>',
      "<main><p>Alpha case body.</p><p>Second alpha case.</p></main>",
      "<script>alpha case script noise</script>",
      "<style>.alpha-case { color: red; }</style>",
      "</body></html>",
    ].join(""),
    sourcePath: "/workspace/docs/test-cases.html",
    zoomPercent: 110,
    searchQuery: "alpha case",
    activeSearchMatchIndex: 1,
  });
  const document = new DOMParser().parseFromString(preview, "text/html");

  expect(document.querySelectorAll("base")).toHaveLength(1);
  expect(document.querySelector("base")?.getAttribute("href")).toBe(
    "about:srcdoc",
  );
  expect(
    document.querySelectorAll("mark[data-document-search-match]"),
  ).toHaveLength(2);
  expect(
    document.querySelector('[data-document-search-match-active="true"]')
      ?.textContent,
  ).toBe("alpha case");
  expect(document.querySelector("script")?.textContent).toBe(
    "alpha case script noise",
  );
  expect(
    document.querySelector("style:not(#spec-viewer-html-preview-style)")
      ?.textContent,
  ).toBe(".alpha-case { color: red; }");
  expect(preview).toContain("--spec-viewer-html-zoom: 1.1;");
});

test.each([
  [
    "<html><head><title>Title</title></head><body>本文</body></html>",
    "<title>Title</title>",
  ],
  ["<html><body>本文</body></html>", "<html><head>"],
  ["<p>本文</p>", "<!doctype html><html><head>"],
])("createHtmlPreviewDocumentはHTML形状に応じてheadを注入する", (contents, expected) => {
  const preview = createHtmlPreviewDocument({
    contents,
    sourcePath: "/workspace/docs/notes.html",
    zoomPercent: 100,
    searchQuery: "",
    activeSearchMatchIndex: 0,
  });

  expect(preview).toContain(expected);
  expect(preview).toContain('<base href="about:srcdoc" />');
});

test("createHtmlPreviewHeadはpreview CSSとzoom scaleを保持する", () => {
  const head = createHtmlPreviewHead(125);

  expect(head).toContain(
    '<meta name="viewport" content="width=device-width, initial-scale=1" />',
  );
  expect(head).toContain('<base href="about:srcdoc" />');
  expect(head).toContain('id="spec-viewer-html-preview-style"');
  expect(head).toContain(
    "img, video, canvas, svg { max-width: 100%; height: auto; }",
  );
  expect(head).toContain("[data-document-search-match]");
  expect(head).toContain("--spec-viewer-html-zoom: 1.25;");
  expect(head).toContain("@supports not (zoom: 1)");
});

test.each([
  [40, 50],
  [50, 50],
  [100, 100],
  [160, 160],
  [170, 160],
])("clampHtmlZoomPercentは%dを%dへ丸める", (input, expected) => {
  expect(clampHtmlZoomPercent(input)).toBe(expected);
});

test("formatHtmlZoomPercentは既存のpercent labelを返す", () => {
  expect(formatHtmlZoomPercent(110)).toBe("110%");
});
