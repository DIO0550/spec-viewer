import { afterEach, expect, test, vi } from "vitest";

import { applyDocumentTheme } from "@/lib/documentTheme";

afterEach(() => {
  vi.unstubAllGlobals();
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.removeAttribute("data-theme-mode");
  document.documentElement.style.colorScheme = "";
});

test("applyDocumentThemeはdocument datasetを更新する", () => {
  applyDocumentTheme("system", "dark");

  expect(document.documentElement.dataset.theme).toBe("dark");
  expect(document.documentElement.dataset.themeMode).toBe("system");
});

test("applyDocumentThemeはcolorSchemeを更新する", () => {
  applyDocumentTheme("light", "light");

  expect(document.documentElement.style.colorScheme).toBe("light");
});

test("applyDocumentThemeはdocument未提供環境でno-opにする", () => {
  vi.stubGlobal("document", undefined);

  expect(() => applyDocumentTheme("dark", "dark")).not.toThrow();
});
