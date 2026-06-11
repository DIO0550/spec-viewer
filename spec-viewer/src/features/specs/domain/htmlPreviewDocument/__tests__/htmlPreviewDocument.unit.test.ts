import { expect, test } from "vitest";

import { HtmlPreviewDocument } from "@/features/specs/domain/htmlPreviewDocument";

test("createは既存のheadへプレビュー用スタイルを差し込む", () => {
  const result = HtmlPreviewDocument.create({
    contents: "<html><head><title>Doc</title></head><body>Hi</body></html>",
    sourcePath: "/specs/report.html",
    zoomPercent: 100,
  });

  expect(result).toContain("<title>Doc</title>");
  expect(result).toContain("--spec-viewer-html-zoom: 1;");
  expect(result.indexOf("spec-viewer-html-preview-style")).toBeLessThan(
    result.indexOf("</head>"),
  );
});

test("createはhead無しのhtmlタグへheadを補ってスタイルを入れる", () => {
  const result = HtmlPreviewDocument.create({
    contents: '<html lang="ja"><body>Hi</body></html>',
    sourcePath: "/specs/report.html",
    zoomPercent: 110,
  });

  expect(result).toContain('<html lang="ja"><head>');
  expect(result).toContain("--spec-viewer-html-zoom: 1.1;");
});

test("createはhtmlタグの無い断片を完全なドキュメントに包む", () => {
  const result = HtmlPreviewDocument.create({
    contents: "<p>fragment</p>",
    sourcePath: "/specs/report.html",
    zoomPercent: 100,
  });

  expect(result.startsWith("<!doctype html>")).toBe(true);
  expect(result).toContain("<body><p>fragment</p></body>");
});

test("createはドキュメント由来のbaseタグを取り除く", () => {
  const result = HtmlPreviewDocument.create({
    contents:
      '<html><head><base href="https://example.com/" /></head><body>Hi</body></html>',
    sourcePath: "/specs/report.html",
    zoomPercent: 100,
  });

  expect(result).not.toContain("https://example.com/");
  expect(result).toContain('<base href="about:srcdoc" />');
});

test.each([
  ['<a href="report.html#section">link</a>', '<a href="#section">link</a>'],
  ['<a href="./report.html#top">link</a>', '<a href="#top">link</a>'],
  ['<a href="#local">link</a>', '<a href="#local">link</a>'],
])("rewriteSameDocumentLinksは同一文書のハッシュリンクを書き換える(%s)", (input, expected) => {
  expect(
    HtmlPreviewDocument.rewriteSameDocumentLinks(input, "/specs/report.html"),
  ).toBe(expected);
});

test.each([
  ['<a href="other.html#section">link</a>'],
  ['<a href="plain.html">link</a>'],
])("rewriteSameDocumentLinksは他文書やハッシュ無しリンクを変更しない(%s)", (input) => {
  expect(
    HtmlPreviewDocument.rewriteSameDocumentLinks(input, "/specs/report.html"),
  ).toBe(input);
});

test.each([
  ["", true],
  [".", true],
  ["./", true],
  ["report.html", true],
  ["docs/report.html", true],
  ["other.html", false],
])("isSameDocumentLinkPathは現在の文書を指すパスを判定する(%j -> %s)", (hrefPath, expected) => {
  expect(
    HtmlPreviewDocument.isSameDocumentLinkPath(hrefPath, "report.html"),
  ).toBe(expected);
});

test.each([
  ["/specs/report.html", "report.html"],
  ["report.html", "report.html"],
  ["docs/report.html?query=1", "report.html"],
  ["docs/report.html#hash", "report.html"],
  ["", ""],
])("getPathFileNameは末尾のパスセグメントを返す(%j)", (path, expected) => {
  expect(HtmlPreviewDocument.getPathFileName(path)).toBe(expected);
});
