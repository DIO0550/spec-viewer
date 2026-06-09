import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test } from "vitest";

import { useLeftNavigationPreference } from "@/features/preferences/hooks/useLeftNavigationPreference";

const storageKey = "spec-reviewer.left-navigation-open";

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
      container.remove();
    },
  };
}

test("useLeftNavigationPreferenceは保存済み設定がなければ左ナビを開いた状態にする", () => {
  window.localStorage.removeItem(storageKey);

  const result = renderHook(useLeftNavigationPreference);

  expect(result.current.isLeftNavigationOpen).toBe(true);
  result.unmount();
  window.localStorage.removeItem(storageKey);
});

test("useLeftNavigationPreferenceは保存済みの閉じた状態を尊重する", () => {
  window.localStorage.setItem(storageKey, "false");

  const result = renderHook(useLeftNavigationPreference);

  expect(result.current.isLeftNavigationOpen).toBe(false);
  result.unmount();
  window.localStorage.removeItem(storageKey);
});

test("useLeftNavigationPreferenceは開いた状態を保存して復元する", () => {
  window.localStorage.setItem(storageKey, "false");

  const result = renderHook(useLeftNavigationPreference);

  act(() => {
    result.current.openLeftNavigation();
  });

  expect(result.current.isLeftNavigationOpen).toBe(true);
  expect(window.localStorage.getItem(storageKey)).toBe("true");
  result.unmount();

  const restored = renderHook(useLeftNavigationPreference);

  expect(restored.current.isLeftNavigationOpen).toBe(true);
  restored.unmount();
  window.localStorage.removeItem(storageKey);
});

test("useLeftNavigationPreferenceは閉じた状態を保存する", () => {
  window.localStorage.setItem(storageKey, "true");

  const result = renderHook(useLeftNavigationPreference);

  act(() => {
    result.current.closeLeftNavigation();
  });

  expect(result.current.isLeftNavigationOpen).toBe(false);
  expect(window.localStorage.getItem(storageKey)).toBe("false");
  result.unmount();
  window.localStorage.removeItem(storageKey);
});
