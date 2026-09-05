import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test } from "vitest";

import { useResizableLeftNavigation } from "@/features/preferences/hooks/useResizableLeftNavigation";

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

test("useResizableLeftNavigationは初期幅を返す", () => {
  window.localStorage.clear();
  window.innerWidth = 1440;

  const result = renderHook(() => useResizableLeftNavigation());

  expect(result.current.leftNavigationWidth).toBe(240);
  result.unmount();
});

test("useResizableLeftNavigationは幅を制約して保存する", () => {
  window.localStorage.clear();
  window.innerWidth = 1440;

  const result = renderHook(() => useResizableLeftNavigation());

  act(() => {
    result.current.resizeLeftNavigationTo(900);
  });

  expect(result.current.leftNavigationWidth).toBe(420);
  expect(
    window.localStorage.getItem("spec-reviewer.left-navigation-width"),
  ).toBe("420");

  act(() => {
    result.current.resizeLeftNavigationTo(120);
  });

  expect(result.current.leftNavigationWidth).toBe(216);
  result.unmount();
});

test("useResizableLeftNavigationは保存幅がviewportに収まらない時に既定幅へ戻す", () => {
  window.localStorage.setItem("spec-reviewer.left-navigation-width", "420");
  window.innerWidth = 760;

  const result = renderHook(() => useResizableLeftNavigation());

  expect(result.current.leftNavigationWidth).toBe(240);
  result.unmount();
});
