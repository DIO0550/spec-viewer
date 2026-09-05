import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, expect, test } from "vitest";

import { useViewerFontSizePreference } from "@/features/preferences/hooks/useViewerFontSizePreference";
type HookResult<Result> = Readonly<{
  current: Result;
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
  };
}

beforeEach(() => {
  window.localStorage.clear();
  delete document.documentElement.dataset.viewerFontSize;
});

test("本文フォントサイズは未設定なら標準を適用する", () => {
  const result = renderHook(() => useViewerFontSizePreference());

  expect(result.current.viewerFontSize).toBe("medium");
  expect(document.documentElement.dataset.viewerFontSize).toBe("medium");
});

test.each([
  ["small", "small"],
  ["medium", "medium"],
  ["large", "large"],
] as const)("本文フォントサイズ%sを保存してdocumentへ反映する", (value, expected) => {
  const result = renderHook(() => useViewerFontSizePreference());

  act(() => {
    result.current.setViewerFontSize(value);
  });

  expect(result.current.viewerFontSize).toBe(expected);
  expect(document.documentElement.dataset.viewerFontSize).toBe(expected);
  expect(window.localStorage.getItem("spec-reviewer.viewer-font-size")).toBe(
    expected,
  );
});

test("不正な保存値は標準へ戻す", () => {
  window.localStorage.setItem("spec-reviewer.viewer-font-size", "huge");

  const result = renderHook(() => useViewerFontSizePreference());

  expect(result.current.viewerFontSize).toBe("medium");
});
