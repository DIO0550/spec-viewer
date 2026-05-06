import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test } from "vitest";

import { useLeftNavigationPreference } from "./useLeftNavigationPreference";

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

test("useLeftNavigationPreferenceは初期状態で左ナビゲーションを閉じる", () => {
  window.localStorage.clear();

  const result = renderHook(() => useLeftNavigationPreference());

  expect(result.current.isLeftNavigationOpen).toBe(false);
  result.unmount();
});

test("useLeftNavigationPreferenceは開いた状態を保存して復元する", () => {
  window.localStorage.clear();

  const result = renderHook(() => useLeftNavigationPreference());

  act(() => {
    result.current.openLeftNavigation();
  });

  expect(result.current.isLeftNavigationOpen).toBe(true);
  expect(
    window.localStorage.getItem("spec-reviewer.left-navigation-open"),
  ).toBe("true");
  result.unmount();

  const restored = renderHook(() => useLeftNavigationPreference());

  expect(restored.current.isLeftNavigationOpen).toBe(true);
  restored.unmount();
});

test("useLeftNavigationPreferenceは閉じた状態を保存する", () => {
  window.localStorage.setItem("spec-reviewer.left-navigation-open", "true");

  const result = renderHook(() => useLeftNavigationPreference());

  act(() => {
    result.current.closeLeftNavigation();
  });

  expect(result.current.isLeftNavigationOpen).toBe(false);
  expect(
    window.localStorage.getItem("spec-reviewer.left-navigation-open"),
  ).toBe("false");
  result.unmount();
});
