import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test } from "vitest";

import { useSidebarPreference } from "@/features/preferences/hooks/useSidebarPreference";

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

test("useSidebarPreferenceは初期状態でサイドバーを開く", () => {
  window.localStorage.clear();

  const result = renderHook(() => useSidebarPreference());

  expect(result.current.isSidebarOpen).toBe(true);
  result.unmount();
});

test("useSidebarPreferenceは閉じた状態を保存して復元する", () => {
  window.localStorage.clear();

  const result = renderHook(() => useSidebarPreference());

  act(() => {
    result.current.closeSidebar();
  });

  expect(result.current.isSidebarOpen).toBe(false);
  expect(
    window.localStorage.getItem("spec-reviewer.comment-sidebar-open"),
  ).toBe("false");
  result.unmount();

  const restored = renderHook(() => useSidebarPreference());

  expect(restored.current.isSidebarOpen).toBe(false);
  restored.unmount();
});

test("useSidebarPreferenceは開いた状態を保存する", () => {
  window.localStorage.setItem("spec-reviewer.comment-sidebar-open", "false");

  const result = renderHook(() => useSidebarPreference());

  act(() => {
    result.current.openSidebar();
  });

  expect(result.current.isSidebarOpen).toBe(true);
  expect(
    window.localStorage.getItem("spec-reviewer.comment-sidebar-open"),
  ).toBe("true");
  result.unmount();
});
