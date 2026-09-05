import { expect, test } from "vitest";

import {
  ThemeAppearance,
  ThemeMode,
} from "@/features/preferences/domain/theme";

test.each([
  "system",
  "light",
  "dark",
] as const)("ThemeModeは%sを有効なmodeとして判定する", (themeMode) => {
  expect(ThemeMode.is(themeMode)).toBe(true);
  expect(ThemeMode.parse(themeMode)).toBe(themeMode);
});

test.each([
  null,
  undefined,
  "",
  "blue",
  1,
  false,
] as const)("ThemeModeは無効値%jをsystemへfallbackする", (value) => {
  expect(ThemeMode.is(value)).toBe(false);
  expect(ThemeMode.parse(value)).toBe("system");
});

test.each([
  "light",
  "dark",
] as const)("ThemeAppearanceは%sを有効なappearanceとして判定する", (themeAppearance) => {
  expect(ThemeAppearance.is(themeAppearance)).toBe(true);
});

test.each([
  { systemAppearance: "light", expected: "light" },
  { systemAppearance: "dark", expected: "dark" },
] as const)("ThemeMode.toAppearanceはsystem modeで現在のsystem appearanceを返す", ({
  systemAppearance,
  expected,
}) => {
  expect(ThemeMode.toAppearance("system", systemAppearance)).toBe(expected);
});

test.each([
  { mode: "light", systemAppearance: "dark", expected: "light" },
  { mode: "dark", systemAppearance: "light", expected: "dark" },
] as const)("ThemeMode.toAppearanceは明示modeでsystem appearanceを無視する", ({
  mode,
  systemAppearance,
  expected,
}) => {
  expect(ThemeMode.toAppearance(mode, systemAppearance)).toBe(expected);
});
