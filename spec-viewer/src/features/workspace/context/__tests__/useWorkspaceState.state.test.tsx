import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";

import {
  selectActiveWorkspaceRoot,
  selectIsWorkspaceOpening,
  selectWorkspace,
  selectWorkspaceError,
  useWorkspaceState,
} from "@/features/workspace/context";
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

test("useWorkspaceStateは初期状態を未選択として返す", () => {
  const loadWorkspace = vi.fn();

  const result = renderHook(() => useWorkspaceState({ loadWorkspace }));

  expect(result.current.state.status).toBe("idle");
  expect(selectActiveWorkspaceRoot(result.current.state)).toBeNull();
  expect(selectWorkspace(result.current.state)).toBeNull();
  expect(selectIsWorkspaceOpening(result.current.state)).toBe(false);
  expect(selectWorkspaceError(result.current.state)).toBeNull();
  expect(typeof result.current.actions.load).toBe("function");
  expect(typeof result.current.actions.reset).toBe("function");
  result.unmount();
});

test("useWorkspaceStateは選択したworkspaceを読み込み成功状態にする", async () => {
  const loadWorkspace = vi.fn().mockResolvedValue(workspace);
  const onWorkspaceLoaded = vi.fn();
  const result = renderHook(() => useWorkspaceState({ loadWorkspace }));

  await act(async () => {
    await result.current.actions.load("/workspace/spec-reviewer", {
      onWorkspaceLoaded,
    });
  });

  expect(result.current.state).toEqual({
    status: "opened",
    workspace,
    lastOpenError: null,
  });
  expect(selectActiveWorkspaceRoot(result.current.state)).toBe(workspace.root);
  expect(loadWorkspace).toHaveBeenCalledWith("/workspace/spec-reviewer");
  expect(onWorkspaceLoaded).toHaveBeenCalledWith(workspace);
  result.unmount();
});

test("useWorkspaceStateは読み込み失敗をWorkspaceError状態にする", async () => {
  const loadWorkspace = vi.fn().mockRejectedValue("missing workspace");
  const result = renderHook(() => useWorkspaceState({ loadWorkspace }));

  await act(async () => {
    await result.current.actions.load("/workspace/missing");
  });

  expect(result.current.state).toEqual({
    status: "failed",
    requestedPath: "/workspace/missing",
    error: {
      reason: "unknown",
      message: "missing workspace",
      cause: {
        code: "unknown",
        message: "missing workspace",
        raw: "missing workspace",
      },
    },
  });
  expect(selectActiveWorkspaceRoot(result.current.state)).toBeNull();
  expect(selectWorkspaceError(result.current.state)?.message).toBe(
    "missing workspace",
  );
  result.unmount();
});

test("useWorkspaceStateは指定時に読み込み失敗後も現在のworkspaceを保持する", async () => {
  const loadWorkspace = vi
    .fn()
    .mockResolvedValueOnce(workspace)
    .mockRejectedValueOnce("unsupported workspace");
  const result = renderHook(() => useWorkspaceState({ loadWorkspace }));

  await act(async () => {
    await result.current.actions.load("/workspace/spec-reviewer");
  });

  await act(async () => {
    const isLoaded = await result.current.actions.load("/workspace/file.md", {
      preserveCurrentWorkspace: true,
    });

    expect(isLoaded).toBe(false);
  });

  expect(result.current.state).toEqual({
    status: "opened",
    workspace,
    lastOpenError: {
      reason: "unknown",
      message: "unsupported workspace",
      cause: {
        code: "unknown",
        message: "unsupported workspace",
        raw: "unsupported workspace",
      },
    },
  });
  expect(selectActiveWorkspaceRoot(result.current.state)).toBe(workspace.root);
  result.unmount();
});
