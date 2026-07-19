import { expect, test } from "vitest";

import { CommentStatusFilter } from "@/features/comments/domain/commentStatusFilter";

test("CommentStatusFilter valuesはIPCコマンドの順序で列挙される", () => {
  expect(CommentStatusFilter.values).toEqual(["all", "open", "resolved"]);
});

test.each([
  ["all", "all"],
  ["open", "open"],
  ["resolved", "resolved"],
  [null, "all"],
  [undefined, "all"],
] as const)("CommentStatusFilter.parseは%jを%sへ正規化する", (value, expected) => {
  expect(CommentStatusFilter.parse(value)).toBe(expected);
});

test.each([
  ["closed"],
  [{ status: "open" }],
] as const)("CommentStatusFilter.parseは不正な入力%jをnullにする", (value) => {
  expect(CommentStatusFilter.parse(value)).toBeNull();
});

test.each([
  "all",
  "open",
  "resolved",
] as const)("CommentStatusFilter.isは有効な入力%sをtrueにする", (value) => {
  expect(CommentStatusFilter.is(value)).toBe(true);
});

test.each([
  null,
  undefined,
  "closed",
] as const)("CommentStatusFilter.isは無効な入力%jをfalseにする", (value) => {
  expect(CommentStatusFilter.is(value)).toBe(false);
});

test.each([
  "all",
  "open",
  "resolved",
] as const)("CommentStatusFilter.toStringは%sを同じ文字列として返す", (filter) => {
  expect(CommentStatusFilter.toString(filter)).toBe(filter);
});

test.each([
  ["all", "open", true],
  ["all", "resolved", true],
  ["open", "open", true],
  ["open", "resolved", false],
  ["resolved", "open", false],
  ["resolved", "resolved", true],
] as const)("CommentStatusFilter.matchesは%s filterと%s statusの一致を%jで返す", (filter, status, expected) => {
  expect(CommentStatusFilter.matches(filter, status)).toBe(expected);
});
