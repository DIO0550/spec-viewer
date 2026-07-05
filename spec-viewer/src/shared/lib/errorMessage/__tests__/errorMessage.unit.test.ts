import { expect, test } from "vitest";

import { getUnknownErrorMessage } from "@/shared/lib/errorMessage";

test("getUnknownErrorMessageはErrorインスタンスのmessageを返す", () => {
  expect(getUnknownErrorMessage(new Error("failed"))).toBe("failed");
});

test("getUnknownErrorMessageは文字列エラーをそのまま返す", () => {
  expect(getUnknownErrorMessage("oops")).toBe("oops");
});

test("getUnknownErrorMessageはmessageプロパティを持つオブジェクトのmessageを返す", () => {
  expect(getUnknownErrorMessage({ message: "broken" })).toBe("broken");
});

test("getUnknownErrorMessageはmessageが非文字列ならフォールバックを返す", () => {
  expect(getUnknownErrorMessage({ message: 42 })).toBe("Unknown failure");
});

test.each([
  ["空文字列", "", ""],
  ["空messageのError", new Error(""), ""],
  ["空messageオブジェクト", { message: "" }, ""],
])("getUnknownErrorMessageは%sをフォールバックに落とさずそのまま返す", (_label, input, expected) => {
  expect(getUnknownErrorMessage(input)).toBe(expected);
});

test.each([
  ["null", null],
  ["undefined", undefined],
  ["数値", 123],
])("getUnknownErrorMessageは%s（型不明値）でフォールバックを返す", (_label, input) => {
  expect(getUnknownErrorMessage(input)).toBe("Unknown failure");
});
