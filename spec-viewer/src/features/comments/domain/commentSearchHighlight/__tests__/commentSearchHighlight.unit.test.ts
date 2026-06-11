import { expect, test } from "vitest";

import { CommentSearchHighlight } from "@/features/comments/domain/commentSearchHighlight";

test("segmentsは検索語が空のとき全文を非マッチとして返す", () => {
  expect(CommentSearchHighlight.segments("Alpha beta", "")).toEqual([
    { text: "Alpha beta", isMatch: false },
  ]);
});

test("segmentsは大文字小文字を無視して全ての出現箇所をマークする", () => {
  expect(CommentSearchHighlight.segments("Alpha beta alpha", "alpha")).toEqual([
    { text: "Alpha", isMatch: true },
    { text: " beta ", isMatch: false },
    { text: "alpha", isMatch: true },
  ]);
});

test("segmentsは末尾の非マッチ部分を保持する", () => {
  expect(CommentSearchHighlight.segments("beta alpha tail", "alpha")).toEqual([
    { text: "beta ", isMatch: false },
    { text: "alpha", isMatch: true },
    { text: " tail", isMatch: false },
  ]);
});

test("segmentsは一致しない検索語のとき全文を非マッチとして返す", () => {
  expect(CommentSearchHighlight.segments("Alpha beta", "gamma")).toEqual([
    { text: "Alpha beta", isMatch: false },
  ]);
});
