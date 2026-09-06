import { expect, test } from "vitest";

import { SidebarWidth } from "@/domains/sidebarWidth";

test.each([
  [0, 280],
  [622, 280],
  [623, 280],
  [760, 342],
  [1244, 559],
  [1245, 560],
  [1440, 560],
])("画面幅%ipxに対するサイドバー上限は%ipx", (viewportWidth, max) => {
  expect(SidebarWidth.constraints(viewportWidth)).toEqual({ min: 280, max });
});

test.each([
  [0, 280],
  [279, 280],
  [280, 280],
  [280.4, 280],
  [280.5, 281],
  [320, 320],
  [559.5, 560],
  [560, 560],
  [561, 560],
])("候補幅%sを丸めて制約内の%sにする", (input, expected) => {
  const width = SidebarWidth.fromNumber(input, SidebarWidth.constraints(1440));

  expect(SidebarWidth.toNumber(width)).toBe(expected);
});

test.each([
  NaN,
  Infinity,
  -Infinity,
])("非有限幅%sは狭い画面でも既定300に戻す", (input) => {
  const width = SidebarWidth.fromNumber(input, SidebarWidth.constraints(600));

  expect(SidebarWidth.toNumber(width)).toBe(300);
});

test("補正後の幅を同じ制約で再補正しても変わらない", () => {
  const constraints = SidebarWidth.constraints(760);
  const width = SidebarWidth.fromNumber(400, constraints);

  expect(SidebarWidth.toNumber(width)).toBe(342);
  expect(SidebarWidth.fromNumber(width, constraints)).toBe(width);
});

test("既定幅も狭い画面へ明示的に補正できる", () => {
  const width = SidebarWidth.fromNumber(
    SidebarWidth.defaultValue,
    SidebarWidth.constraints(600),
  );

  expect(SidebarWidth.toNumber(width)).toBe(280);
});
