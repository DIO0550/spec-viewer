import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test } from "vitest";

import { useResizableSidebar } from "@/features/preferences/hooks/useResizableSidebar";

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

test("useResizableSidebarは初期幅を返す", () => {
  window.localStorage.clear();
  window.innerWidth = 1440;

  const result = renderHook(() => useResizableSidebar());

  expect(result.current.sidebarWidth).toBe(360);
  result.unmount();
});

test("useResizableSidebarは幅を制約して保存する", () => {
  window.localStorage.clear();
  window.innerWidth = 1440;

  const result = renderHook(() => useResizableSidebar());

  act(() => {
    result.current.resizeSidebarTo(900);
  });

  expect(result.current.sidebarWidth).toBe(560);
  expect(
    window.localStorage.getItem("spec-reviewer.comment-sidebar-width"),
  ).toBe("560");

  act(() => {
    result.current.resizeSidebarTo(120);
  });

  expect(result.current.sidebarWidth).toBe(280);
  result.unmount();
});

test("useResizableSidebarは保存幅をviewportに合わせて復元する", () => {
  window.localStorage.setItem("spec-reviewer.comment-sidebar-width", "560");
  window.innerWidth = 760;

  const result = renderHook(() => useResizableSidebar());

  expect(result.current.sidebarWidth).toBe(342);
  result.unmount();
});
