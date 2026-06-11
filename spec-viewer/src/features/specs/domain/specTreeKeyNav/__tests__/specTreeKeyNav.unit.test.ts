import { expect, test } from "vitest";

import { SpecTreeKeyNav } from "@/features/specs/domain/specTreeKeyNav";

const levels = [1, 2, 2, 1] as const;

test.each([
  ["ArrowDown", 1, 2],
  ["ArrowDown", 3, 3],
  ["ArrowUp", 1, 0],
  ["ArrowUp", 0, 0],
  ["Home", 2, 0],
  ["End", 0, 3],
] as const)("nextIndexは%sで%d番目から%d番目へ移動する", (key, currentIndex, expected) => {
  expect(SpecTreeKeyNav.nextIndex({ key, levels, currentIndex })).toBe(
    expected,
  );
});

test("nextIndexはArrowRightで最初の子へ移動する", () => {
  expect(
    SpecTreeKeyNav.nextIndex({ key: "ArrowRight", levels, currentIndex: 0 }),
  ).toBe(1);
});

test("nextIndexはArrowRightでも子が無いときnullを返す", () => {
  expect(
    SpecTreeKeyNav.nextIndex({ key: "ArrowRight", levels, currentIndex: 2 }),
  ).toBeNull();
});

test("nextIndexはArrowLeftで親へ移動する", () => {
  expect(
    SpecTreeKeyNav.nextIndex({ key: "ArrowLeft", levels, currentIndex: 2 }),
  ).toBe(0);
});

test("nextIndexはArrowLeftでもルート項目のときnullを返す", () => {
  expect(
    SpecTreeKeyNav.nextIndex({ key: "ArrowLeft", levels, currentIndex: 3 }),
  ).toBeNull();
});

test.each([
  ["未対応キー", "Enter", 0],
  ["範囲外のインデックス", "ArrowDown", -1],
] as const)("nextIndexは%sのときnullを返す", (_label, key, currentIndex) => {
  expect(SpecTreeKeyNav.nextIndex({ key, levels, currentIndex })).toBeNull();
});

test.each([
  ["ArrowRight", true, false, true],
  ["ArrowRight", true, true, false],
  ["ArrowRight", false, false, false],
  ["ArrowLeft", true, true, true],
  ["ArrowLeft", true, false, false],
  ["ArrowDown", true, false, false],
] as const)("shouldToggleExpansionは%s(子=%s,展開=%s)で%sを返す", (key, hasChildren, isExpanded, expected) => {
  expect(
    SpecTreeKeyNav.shouldToggleExpansion({ key, hasChildren, isExpanded }),
  ).toBe(expected);
});
