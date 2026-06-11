import { expect, test } from "vitest";

import { HtmlZoom } from "@/features/specs/domain/htmlZoom";

test.each([
  [40, 50],
  [50, 50],
  [100, 100],
  [160, 160],
  [200, 160],
])("clampPercentはサポート範囲に丸める(%i -> %i)", (input, expected) => {
  expect(HtmlZoom.clampPercent(input)).toBe(expected);
});

test.each([
  [100, 90],
  [50, 50],
  [55, 50],
])("decreasePercentは1段階縮小し下限で止まる(%i -> %i)", (input, expected) => {
  expect(HtmlZoom.decreasePercent(input)).toBe(expected);
});

test.each([
  [100, 110],
  [160, 160],
  [155, 160],
])("increasePercentは1段階拡大し上限で止まる(%i -> %i)", (input, expected) => {
  expect(HtmlZoom.increasePercent(input)).toBe(expected);
});

test("formatPercentはパーセント表記のラベルを返す", () => {
  expect(HtmlZoom.formatPercent(110)).toBe("110%");
});

test.each([
  [100, "1"],
  [110, "1.1"],
  [155, "1.55"],
  [50, "0.5"],
])("formatScaleは余分な0を除いたCSS数値を返す(%i -> %s)", (input, expected) => {
  expect(HtmlZoom.formatScale(input)).toBe(expected);
});
