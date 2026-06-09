import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test } from "vitest";

import type { RecentWorkspaceStorage } from "@/shared/lib/recentWorkspaces";
import { useRecentWorkspaces } from "@/features/workspace/hooks/useRecentWorkspaces";

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

test("useRecentWorkspacesは保存済みworkspaceの追加と削除をstorageへ同期する", () => {
  const storage = new MemoryStorage();
  const result = renderHook(() => useRecentWorkspaces({ storage }));

  act(() => {
    result.current.recordWorkspace({
      root: "/workspace/alpha",
      kind: "plugin-workspace",
      files: [],
    });
    result.current.recordWorkspace({
      root: "/workspace/beta",
      kind: "spec-skill",
      files: [],
    });
    result.current.removeWorkspace("/workspace/alpha");
  });

  expect(
    result.current.recentWorkspaces.map((workspace) => workspace.path),
  ).toEqual(["/workspace/beta"]);
  expect(result.current.lastActiveWorkspacePath).toBe("/workspace/beta");
  expect(storage.getItem("spec-reviewer.recent-workspaces")).toContain(
    "/workspace/beta",
  );
  expect(storage.getItem("spec-reviewer.last-active-workspace")).toBe(
    "/workspace/beta",
  );
  result.unmount();
});

test("useRecentWorkspacesはclearでstorageから保存済み一覧とlast activeを削除する", () => {
  const storage = new MemoryStorage();
  const result = renderHook(() => useRecentWorkspaces({ storage }));

  act(() => {
    result.current.recordWorkspace({
      root: "/workspace/alpha",
      kind: "plugin-workspace",
      files: [],
    });
    result.current.clearWorkspaces();
  });

  expect(result.current.recentWorkspaces).toEqual([]);
  expect(storage.getItem("spec-reviewer.recent-workspaces")).toBeNull();
  expect(storage.getItem("spec-reviewer.last-active-workspace")).toBeNull();
  result.unmount();
});

test("useRecentWorkspacesは保存済みlast activeを起動時復元候補として返す", () => {
  const storage = new MemoryStorage();

  storage.setItem("spec-reviewer.last-active-workspace", "/workspace/alpha");

  const result = renderHook(() => useRecentWorkspaces({ storage }));

  expect(result.current.lastActiveWorkspacePath).toBe("/workspace/alpha");
  result.unmount();
});
