import { expect, test } from "vitest";

import { PanelResize } from "@/shared/ui/AppShell/panelResize";

const bodyRect = { left: 100, right: 900 } as const;

test.each([
  ["left", 350, 250],
  ["right", 700, 200],
] as const)("widthFromPointerは%sパネル幅をポインタ位置から求める", (side, clientX, expected) => {
  expect(PanelResize.widthFromPointer({ side, bodyRect, clientX })).toBe(
    expected,
  );
});

test.each([
  ["left", "ArrowRight", 316],
  ["left", "ArrowLeft", 284],
  ["right", "ArrowLeft", 316],
  ["right", "ArrowRight", 284],
] as const)("widthFromKeyboardは%sパネルで%sにより幅を変更する", (side, key, expected) => {
  expect(
    PanelResize.widthFromKeyboard({
      side,
      key,
      currentWidth: 300,
      minWidth: 200,
      maxWidth: 500,
    }),
  ).toBe(expected);
});

test.each([
  ["Home", 200],
  ["End", 500],
] as const)("widthFromKeyboardは%sで境界幅へ移動する", (key, expected) => {
  expect(
    PanelResize.widthFromKeyboard({
      side: "left",
      key,
      currentWidth: 300,
      minWidth: 200,
      maxWidth: 500,
    }),
  ).toBe(expected);
});

test("widthFromKeyboardは未対応キーのときnullを返す", () => {
  expect(
    PanelResize.widthFromKeyboard({
      side: "left",
      key: "Enter",
      currentWidth: 300,
      minWidth: 200,
      maxWidth: 500,
    }),
  ).toBeNull();
});
