import { expect, test } from "vitest";

import { DocumentSearch } from "@/features/specs/domain/documentSearch";

test.each([
  ["  Phase 1  ", "phase 1"],
  ["ABC", "abc"],
  ["", ""],
  ["   ", ""],
])("normalizeQueryは前後空白を除去し小文字化する(%j)", (input, expected) => {
  expect(DocumentSearch.normalizeQuery(input)).toBe(expected);
});

test.each([
  [{ hasQuery: false, matchCount: 5, activeMatchIndex: 2 }, "0件"],
  [{ hasQuery: true, matchCount: 0, activeMatchIndex: 0 }, "0件"],
  [{ hasQuery: true, matchCount: 5, activeMatchIndex: 0 }, "1/5"],
  [{ hasQuery: true, matchCount: 5, activeMatchIndex: 4 }, "5/5"],
])("formatStatusは検索状態に応じた件数表示を返す(%j)", (input, expected) => {
  expect(DocumentSearch.formatStatus(input)).toBe(expected);
});

test.each([
  [0, 0, 0],
  [3, 0, 0],
  [3, 2, 1],
  [3, 3, 2],
  [2, 5, 2],
])("clampIndexは件数の上限内に丸める(index=%i, count=%i)", (index, matchCount, expected) => {
  expect(DocumentSearch.clampIndex(index, matchCount)).toBe(expected);
});

test.each([
  [0, 3, 2],
  [2, 3, 1],
  [0, 0, 0],
])("previousIndexは先頭から末尾へ巡回する(current=%i, count=%i)", (currentIndex, matchCount, expected) => {
  expect(DocumentSearch.previousIndex(currentIndex, matchCount)).toBe(expected);
});

test.each([
  [2, 3, 0],
  [0, 3, 1],
  [0, 0, 0],
])("nextIndexは末尾から先頭へ巡回する(current=%i, count=%i)", (currentIndex, matchCount, expected) => {
  expect(DocumentSearch.nextIndex(currentIndex, matchCount)).toBe(expected);
});

test("createCursorは空クエリでnullを返す", () => {
  expect(DocumentSearch.createCursor({ query: "", activeIndex: 2 })).toBeNull();
});

test("createCursorはクエリありでmatchIndexを0に初期化したカーソルを返す", () => {
  expect(
    DocumentSearch.createCursor({ query: "phase", activeIndex: 2 }),
  ).toEqual({
    query: "phase",
    activeIndex: 2,
    matchIndex: 0,
  });
});

test("countRenderedMatchesは描画済みマッチ要素の数を返す", () => {
  const renderedRoot = document.createElement("div");
  renderedRoot.innerHTML = [
    '<mark data-document-search-match="true">a</mark>',
    '<mark data-document-search-match="true">b</mark>',
    "<mark>plain</mark>",
  ].join("");

  expect(
    DocumentSearch.countRenderedMatches({
      renderedRoot,
      searchQuery: "a",
    }),
  ).toBe(2);
});

test("countRenderedMatchesはルート未描画または空クエリで0を返す", () => {
  const renderedRoot = document.createElement("div");
  renderedRoot.innerHTML = '<mark data-document-search-match="true">a</mark>';

  expect(
    DocumentSearch.countRenderedMatches({
      renderedRoot: null,
      searchQuery: "a",
    }),
  ).toBe(0);
  expect(
    DocumentSearch.countRenderedMatches({ renderedRoot, searchQuery: "" }),
  ).toBe(0);
});
