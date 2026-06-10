import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import { useWorkspace } from "@/features/workspace/hooks/useWorkspace";
import type { Workspace } from "@/features/workspace/types/workspace";

const workspace: Workspace = {
  root: "/workspace/spec-reviewer",
  kind: "plugin-workspace",
  files: [{ key: "tasks", label: "Tasks", fileName: "tasks.md" }],
};

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

test("useWorkspaceは初期状態を未選択として返す", () => {
  const loadWorkspace = vi.fn();

  const result = renderHook(() => useWorkspace({ loadWorkspace }));

  expect(result.current.state.status).toBe("idle");
  expect(result.current.workspacePath).toBeNull();
  expect(result.current.workspace).toBeNull();
  result.unmount();
});

test("useWorkspaceは選択したworkspaceを読み込み成功状態にする", async () => {
  const loadWorkspace = vi.fn().mockResolvedValue(workspace);
  const onWorkspaceLoaded = vi.fn();
  const result = renderHook(() => useWorkspace({ loadWorkspace }));

  await act(async () => {
    await result.current.load("/workspace/spec-reviewer", {
      onWorkspaceLoaded,
    });
  });

  expect(result.current.state).toEqual({
    status: "ready",
    workspacePath: "/workspace/spec-reviewer",
    workspace,
    error: null,
  });
  expect(loadWorkspace).toHaveBeenCalledWith("/workspace/spec-reviewer");
  expect(onWorkspaceLoaded).toHaveBeenCalledWith(workspace);
  result.unmount();
});

test("useWorkspaceは読み込み失敗を正規化済みerror状態にする", async () => {
  const loadWorkspace = vi.fn().mockRejectedValue("missing workspace");
  const result = renderHook(() => useWorkspace({ loadWorkspace }));

  await act(async () => {
    await result.current.load("/workspace/missing");
  });

  expect(result.current.state).toEqual({
    status: "error",
    workspacePath: "/workspace/missing",
    workspace: null,
    error: {
      code: "unknown",
      message: "missing workspace",
      raw: "missing workspace",
    },
  });
  result.unmount();
});

test("useWorkspaceは指定時に読み込み失敗後も現在のworkspaceを保持する", async () => {
  const loadWorkspace = vi
    .fn()
    .mockResolvedValueOnce(workspace)
    .mockRejectedValueOnce("unsupported workspace");
  const result = renderHook(() => useWorkspace({ loadWorkspace }));

  await act(async () => {
    await result.current.load("/workspace/spec-reviewer");
  });

  await act(async () => {
    const isLoaded = await result.current.load("/workspace/file.md", {
      preserveCurrentWorkspace: true,
    });

    expect(isLoaded).toBe(false);
  });

  expect(result.current.state).toEqual({
    status: "ready",
    workspacePath: "/workspace/spec-reviewer",
    workspace,
    error: {
      code: "unknown",
      message: "unsupported workspace",
      raw: "unsupported workspace",
    },
  });
  result.unmount();
});
