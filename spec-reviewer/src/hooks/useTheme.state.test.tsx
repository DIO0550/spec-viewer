import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";

import { useTheme } from "./useTheme";

type HookResult<Result> = Readonly<{
  current: Result;
  unmount: () => void;
}>;

function renderHook<Result>(hook: () => Result): HookResult<Result> {
  const container = document.createElement("div");
  const root = createRoot(container);
  const result = { current: undefined as Result };

  function TestComponent(): null {
    result.current = hook();
    return null;
  }

  act(() => {
    root.render(<TestComponent />);
  });

  return {
    get current() {
      return result.current;
    },
    unmount: () => {
      act(() => {
        root.unmount();
      });
    },
  };
}

function resetThemeEnvironment(prefersDark: boolean): void {
  window.localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.removeAttribute("data-theme-mode");
  document.documentElement.style.colorScheme = "";
  vi.stubGlobal("matchMedia", createMatchMedia(prefersDark));
}

function createMatchMedia(prefersDark: boolean): typeof window.matchMedia {
  return vi.fn().mockReturnValue({
    matches: prefersDark,
    media: "(prefers-color-scheme: dark)",
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  });
}

test("useThemeはsystemを初期値にしてOSのdarkを反映する", () => {
  resetThemeEnvironment(true);

  const result = renderHook(() => useTheme());

  expect(result.current.themeMode).toBe("system");
  expect(result.current.resolvedTheme).toBe("dark");
  expect(document.documentElement.dataset.theme).toBe("dark");
  expect(document.documentElement.dataset.themeMode).toBe("system");
  result.unmount();
});

test("useThemeは選択したlight preferenceを保存してdocumentへ反映する", () => {
  resetThemeEnvironment(true);
  const result = renderHook(() => useTheme());

  act(() => {
    result.current.setThemeMode("light");
  });

  expect(result.current.themeMode).toBe("light");
  expect(result.current.resolvedTheme).toBe("light");
  expect(window.localStorage.getItem("spec-reviewer.theme-mode")).toBe("light");
  expect(document.documentElement.dataset.theme).toBe("light");
  expect(document.documentElement.style.colorScheme).toBe("light");
  result.unmount();
});

test("useThemeは保存済みdark preferenceを初期値にする", () => {
  resetThemeEnvironment(false);
  window.localStorage.setItem("spec-reviewer.theme-mode", "dark");

  const result = renderHook(() => useTheme());

  expect(result.current.themeMode).toBe("dark");
  expect(result.current.resolvedTheme).toBe("dark");
  expect(document.documentElement.dataset.theme).toBe("dark");
  result.unmount();
});
