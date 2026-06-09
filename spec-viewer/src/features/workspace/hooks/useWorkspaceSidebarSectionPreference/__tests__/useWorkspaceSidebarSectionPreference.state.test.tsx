import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test } from "vitest";

import { useWorkspaceSidebarSectionPreference } from "@/features/workspace/hooks/useWorkspaceSidebarSectionPreference";

const storageKey = "spec-reviewer.workspace-sidebar-section-open";

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

test("useWorkspaceSidebarSectionPreferenceは初期状態でworkspaceセクションを開く", () => {
  window.localStorage.removeItem(storageKey);

  const result = renderHook(useWorkspaceSidebarSectionPreference);

  expect(result.current.isWorkspaceSidebarSectionOpen).toBe(true);
  result.unmount();
  window.localStorage.removeItem(storageKey);
});

test("useWorkspaceSidebarSectionPreferenceは閉じた状態を保存して復元する", () => {
  window.localStorage.removeItem(storageKey);

  const result = renderHook(useWorkspaceSidebarSectionPreference);

  act(() => {
    result.current.toggleWorkspaceSidebarSection();
  });

  expect(result.current.isWorkspaceSidebarSectionOpen).toBe(false);
  expect(window.localStorage.getItem(storageKey)).toBe("false");
  result.unmount();

  const restored = renderHook(useWorkspaceSidebarSectionPreference);

  expect(restored.current.isWorkspaceSidebarSectionOpen).toBe(false);
  restored.unmount();
  window.localStorage.removeItem(storageKey);
});

test("useWorkspaceSidebarSectionPreferenceは開いた状態を保存する", () => {
  window.localStorage.setItem(storageKey, "false");

  const result = renderHook(useWorkspaceSidebarSectionPreference);

  act(() => {
    result.current.toggleWorkspaceSidebarSection();
  });

  expect(result.current.isWorkspaceSidebarSectionOpen).toBe(true);
  expect(window.localStorage.getItem(storageKey)).toBe("true");
  result.unmount();
  window.localStorage.removeItem(storageKey);
});
