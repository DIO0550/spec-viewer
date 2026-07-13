import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, expect, test, vi } from "vitest";

import type { Workspace } from "@/features/workspace/types/workspace";
import { workspacePathFixture } from "@/features/workspace/testing/workspacePath";

const loadWorkspaceMock = vi.hoisted(() =>
  vi.fn<(selectedDirectory: string) => Promise<Workspace>>(),
);

vi.mock("@/shared/api/tauri", async (importActual) => {
  const actual = await importActual<typeof import("@/shared/api/tauri")>();

  return {
    ...actual,
    loadWorkspace: loadWorkspaceMock,
  };
});

import {
  selectActiveWorkspaceRoot,
  selectIsWorkspaceOpening,
  selectWorkspace,
  selectWorkspaceError,
  useWorkspaceState,
} from "@/features/workspace/context";

const workspace: Workspace = {
  root: workspacePathFixture("/workspace/spec-reviewer"),
  kind: "plugin-workspace",
  files: [{ key: "tasks", label: "Tasks", fileName: "tasks.md" }],
};

const otherWorkspace: Workspace = {
  root: workspacePathFixture("/workspace/other"),
  kind: "plugin-workspace",
  files: [{ key: "tasks", label: "Tasks", fileName: "tasks.md" }],
};

type HookResult<Result> = Readonly<{
  current: Result;
  unmount: () => void;
}>;

type Deferred<Value> = Readonly<{
  promise: Promise<Value>;
  resolve: (value: Value) => void;
  reject: (reason: unknown) => void;
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

function createDeferred<Value>(): Deferred<Value> {
  let resolve!: (value: Value) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<Value>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });

  return { promise, resolve, reject };
}

beforeEach(() => {
  loadWorkspaceMock.mockReset();
});

test("useWorkspaceStateは初期状態を未選択として返す", () => {
  const result = renderHook(() => useWorkspaceState());

  expect(result.current.state.status).toBe("idle");
  expect(selectActiveWorkspaceRoot(result.current.state)).toBeNull();
  expect(selectWorkspace(result.current.state)).toBeNull();
  expect(selectIsWorkspaceOpening(result.current.state)).toBe(false);
  expect(selectWorkspaceError(result.current.state)).toBeNull();
  expect(typeof result.current.actions.load).toBe("function");
  expect(typeof result.current.actions.reset).toBe("function");
  expect(loadWorkspaceMock).not.toHaveBeenCalled();
  result.unmount();
});

test("useWorkspaceStateは選択したworkspaceを読み込み成功状態にする", async () => {
  loadWorkspaceMock.mockResolvedValue(workspace);
  const onWorkspaceLoaded = vi.fn();
  const result = renderHook(() => useWorkspaceState());

  await act(async () => {
    const isLoaded = await result.current.actions.load(
      workspacePathFixture("/workspace/spec-reviewer"),
      { onWorkspaceLoaded },
    );

    expect(isLoaded).toBe(true);
  });

  expect(result.current.state).toEqual({
    status: "opened",
    workspace,
    lastOpenError: null,
  });
  expect(selectActiveWorkspaceRoot(result.current.state)).toBe(workspace.root);
  expect(loadWorkspaceMock).toHaveBeenCalledWith("/workspace/spec-reviewer");
  expect(onWorkspaceLoaded).toHaveBeenCalledWith(workspace);
  result.unmount();
});

test("useWorkspaceStateは読み込み後callbackの例外をopen失敗状態にする", async () => {
  loadWorkspaceMock.mockResolvedValue(workspace);
  const onWorkspaceLoaded = vi.fn(() => {
    throw new Error("recent workspace storage failed");
  });
  const result = renderHook(() => useWorkspaceState());

  let isLoaded!: boolean;
  await act(async () => {
    isLoaded = await result.current.actions.load(
      workspacePathFixture("/workspace/spec-reviewer"),
      {
        onWorkspaceLoaded,
      },
    );
  });

  expect(isLoaded).toBe(false);
  expect(result.current.state).toMatchObject({
    status: "failed",
    requestedPath: workspacePathFixture("/workspace/spec-reviewer"),
    error: {
      reason: "unknown",
      message: "recent workspace storage failed",
    },
  });
  result.unmount();
});

test("useWorkspaceStateは読み込み失敗をWorkspaceError状態にする", async () => {
  loadWorkspaceMock.mockRejectedValue("missing workspace");
  const result = renderHook(() => useWorkspaceState());

  await act(async () => {
    await result.current.actions.load(
      workspacePathFixture("/workspace/missing"),
    );
  });

  expect(result.current.state).toEqual({
    status: "failed",
    requestedPath: workspacePathFixture("/workspace/missing"),
    error: {
      reason: "unknown",
      message: "missing workspace",
      cause: {
        command: "load_workspace",
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
  loadWorkspaceMock
    .mockResolvedValueOnce(workspace)
    .mockRejectedValueOnce("unsupported workspace");
  const result = renderHook(() => useWorkspaceState());

  await act(async () => {
    await result.current.actions.load(
      workspacePathFixture("/workspace/spec-reviewer"),
    );
  });

  await act(async () => {
    const isLoaded = await result.current.actions.load(
      workspacePathFixture("/workspace/file.md"),
      { preserveCurrentWorkspace: true },
    );

    expect(isLoaded).toBe(false);
  });

  expect(result.current.state).toEqual({
    status: "opened",
    workspace,
    lastOpenError: {
      reason: "unknown",
      message: "unsupported workspace",
      cause: {
        command: "load_workspace",
        code: "unknown",
        message: "unsupported workspace",
        raw: "unsupported workspace",
      },
    },
  });
  expect(selectActiveWorkspaceRoot(result.current.state)).toBe(workspace.root);
  result.unmount();
});

test("useWorkspaceStateは古いload成功で最新workspace stateを上書きしない", async () => {
  const firstLoad = createDeferred<Workspace>();
  const firstOnWorkspaceLoaded = vi.fn();
  const secondOnWorkspaceLoaded = vi.fn();
  loadWorkspaceMock
    .mockReturnValueOnce(firstLoad.promise)
    .mockResolvedValueOnce(otherWorkspace);
  const result = renderHook(() => useWorkspaceState());

  let firstResult!: Promise<boolean>;
  act(() => {
    firstResult = result.current.actions.load(
      workspacePathFixture("/workspace/spec-reviewer"),
      { onWorkspaceLoaded: firstOnWorkspaceLoaded },
    );
  });

  await act(async () => {
    const isLoaded = await result.current.actions.load(
      workspacePathFixture("/workspace/other"),
      { onWorkspaceLoaded: secondOnWorkspaceLoaded },
    );

    expect(isLoaded).toBe(true);
  });

  await act(async () => {
    firstLoad.resolve(workspace);
    const isLoaded = await firstResult;

    expect(isLoaded).toBe(false);
  });

  expect(result.current.state).toEqual({
    status: "opened",
    workspace: otherWorkspace,
    lastOpenError: null,
  });
  expect(firstOnWorkspaceLoaded).not.toHaveBeenCalled();
  expect(secondOnWorkspaceLoaded).toHaveBeenCalledWith(otherWorkspace);
  result.unmount();
});

test("useWorkspaceStateはreset後のload成功でidle stateを上書きしない", async () => {
  const load = createDeferred<Workspace>();
  const onWorkspaceLoaded = vi.fn();
  loadWorkspaceMock.mockReturnValue(load.promise);
  const result = renderHook(() => useWorkspaceState());

  let loadResult!: Promise<boolean>;
  act(() => {
    loadResult = result.current.actions.load(
      workspacePathFixture("/workspace/spec-reviewer"),
      { onWorkspaceLoaded },
    );
  });

  act(() => {
    result.current.actions.reset();
  });

  await act(async () => {
    load.resolve(workspace);
    const isLoaded = await loadResult;

    expect(isLoaded).toBe(false);
  });

  expect(result.current.state).toEqual({ status: "idle" });
  expect(onWorkspaceLoaded).not.toHaveBeenCalled();
  result.unmount();
});

test("useWorkspaceStateは古いload失敗で最新workspace stateを上書きしない", async () => {
  const firstLoad = createDeferred<Workspace>();
  loadWorkspaceMock
    .mockReturnValueOnce(firstLoad.promise)
    .mockResolvedValueOnce(otherWorkspace);
  const result = renderHook(() => useWorkspaceState());

  let firstResult!: Promise<boolean>;
  act(() => {
    firstResult = result.current.actions.load(
      workspacePathFixture("/workspace/missing"),
    );
  });

  await act(async () => {
    await result.current.actions.load(workspacePathFixture("/workspace/other"));
  });

  await act(async () => {
    firstLoad.reject("missing workspace");
    const isLoaded = await firstResult;

    expect(isLoaded).toBe(false);
  });

  expect(result.current.state).toEqual({
    status: "opened",
    workspace: otherWorkspace,
    lastOpenError: null,
  });
  expect(selectWorkspaceError(result.current.state)).toBeNull();
  result.unmount();
});
