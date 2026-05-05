import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test } from "vitest";

import type { RecentWorkspaceStorage } from "../lib/recentWorkspaces";
import { useRecentWorkspaces } from "./useRecentWorkspaces";

class MemoryStorage implements RecentWorkspaceStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

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

test("useRecentWorkspacesは追加と削除をstorageへ同期する", () => {
  const storage = new MemoryStorage();
  const result = renderHook(() => useRecentWorkspaces({ storage }));

  act(() => {
    result.current.recordWorkspace("/workspace/alpha");
    result.current.recordWorkspace("/workspace/beta");
    result.current.removeWorkspace("/workspace/alpha");
  });

  expect(
    result.current.recentWorkspaces.map((workspace) => workspace.path),
  ).toEqual(["/workspace/beta"]);
  expect(storage.getItem("spec-reviewer.recent-workspaces")).toContain(
    "/workspace/beta",
  );
  result.unmount();
});

test("useRecentWorkspacesはclearでstorageから recent list を削除する", () => {
  const storage = new MemoryStorage();
  const result = renderHook(() => useRecentWorkspaces({ storage }));

  act(() => {
    result.current.recordWorkspace("/workspace/alpha");
    result.current.clearWorkspaces();
  });

  expect(result.current.recentWorkspaces).toEqual([]);
  expect(storage.getItem("spec-reviewer.recent-workspaces")).toBeNull();
  result.unmount();
});
