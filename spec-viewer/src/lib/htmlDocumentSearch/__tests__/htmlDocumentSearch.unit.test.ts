import { expect, test } from "vitest";

import {
  createHtmlSearchIndex,
  findHtmlSearchMatches,
  highlightHtmlDocument,
} from "@/lib/htmlDocumentSearch";

test("HTML検索indexはbody本文だけを抽出し除外要素を含めない", () => {
  const index = createHtmlSearchIndex(
    [
      "<!doctype html>",
      "<html>",
      "<head><title>Hidden Title</title></head>",
      "<body>",
      "<h1>Visible Case</h1>",
      "<script>Visible Case script noise</script>",
      "<style>.visible-case { color: red; }</style>",
      "<template>Visible Case template noise</template>",
      "<noscript>Visible Case noscript noise</noscript>",
      "</body>",
      "</html>",
    ].join(""),
  );

  expect(index.normalizedText).toBe("visible case");
});

test("HTML検索indexはタグ名と属性値を検索対象に含めない", () => {
  const index = createHtmlSearchIndex(
    '<section data-key="needle"><custom-needle>Visible text</custom-needle></section>',
  );

  expect(findHtmlSearchMatches(index, "needle")).toHaveLength(0);
  expect(findHtmlSearchMatches(index, "visible text")).toHaveLength(1);
});

test("HTML検索matchは空白と大文字小文字を正規化して数える", () => {
  const index = createHtmlSearchIndex(
    "<main>Alpha\n   Beta <span>alpha beta</span></main>",
  );

  expect(findHtmlSearchMatches(index, " alpha beta ")).toEqual([
    { index: 0, start: 0, end: 10 },
    { index: 1, start: 11, end: 21 },
  ]);
});

test("HTML検索matchは重複しない一致を出現順で返す", () => {
  const index = createHtmlSearchIndex("<p>aaaa</p>");

  expect(findHtmlSearchMatches(index, "aa")).toEqual([
    { index: 0, start: 0, end: 2 },
    { index: 1, start: 2, end: 4 },
  ]);
});

test("HTML highlightはbody本文にmarkを付けactive一致を示す", () => {
  const highlighted = highlightHtmlDocument(
    "<main><p>Alpha beta alpha</p></main>",
    "alpha",
    1,
  );
  const document = new DOMParser().parseFromString(highlighted, "text/html");
  const marks = document.querySelectorAll("[data-document-search-match]");

  expect(marks).toHaveLength(2);
  expect(marks[0]?.textContent).toBe("Alpha");
  expect(marks[1]?.textContent).toBe("alpha");
  expect(
    document.querySelector('[data-document-search-match-active="true"]')
      ?.textContent,
  ).toBe("alpha");
});

test("HTML highlightは除外要素の中身を変更しない", () => {
  const highlighted = highlightHtmlDocument(
    "<main><p>Alpha</p><script>Alpha</script><style>.alpha{}</style></main>",
    "alpha",
    0,
  );
  const document = new DOMParser().parseFromString(highlighted, "text/html");

  expect(
    document.querySelectorAll("[data-document-search-match]"),
  ).toHaveLength(1);
  expect(document.querySelector("script")?.innerHTML).toBe("Alpha");
  expect(document.querySelector("style")?.innerHTML).toBe(".alpha{}");
});
