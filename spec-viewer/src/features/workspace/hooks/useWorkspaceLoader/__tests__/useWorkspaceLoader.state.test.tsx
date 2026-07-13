import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";

import { WorkspaceProvider } from "@/features/workspace";
import type { WorkspacePath } from "@/features/workspace";
import type {
  LoadWorkspaceOptions,
  WorkspaceContextValue,
  WorkspaceState,
} from "@/features/workspace/context/types";
import type { SubscribeWorkspaceDragDropEvents } from "@/features/workspace/hooks/useWorkspaceDrop";
import {
  type UseWorkspaceLoaderOptions,
  type UseWorkspaceLoaderResult,
  useWorkspaceLoader,
} from "@/features/workspace/hooks/useWorkspaceLoader";
import { workspacePathFixture } from "@/features/workspace/testing/workspacePath";
import type { WorkspaceDragDropEvent } from "@/shared/api/tauri";
import { getUnknownErrorMessage } from "@/shared/lib/errorMessage";
import type { RecentWorkspaceStorage } from "@/features/workspace/infrastructure/recentWorkspaces";
import { writeLastActiveWorkspacePath } from "@/features/workspace/infrastructure/recentWorkspaces";

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

function openedState(root: string): WorkspaceState {
  return {
    status: "opened",
    workspace: {
      root: workspacePathFixture(root),
      kind: "plugin-workspace",
      files: [],
    },
    lastOpenError: null,
  };
}

function openingState(): WorkspaceState {
  return {
    status: "opening",
    requestedPath: workspacePathFixture("/pending"),
    currentWorkspace: null,
    error: null,
  };
}

function idleState(): WorkspaceState {
  return { status: "idle" };
}

function fakeWorkspace(
  state: WorkspaceState,
  overrides: Partial<WorkspaceContextValue["actions"]> = {},
): WorkspaceContextValue {
  return {
    state,
    actions: {
      load: vi.fn(async () => true),
      reset: vi.fn(),
      ...overrides,
    },
  };
}

function defaultCommands() {
  return {
    selectWorkspaceDirectory: vi.fn(async () => "/selected"),
    validateWorkspaceDirectory: vi.fn(async () => ({ isDirectory: true })),
  };
}

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

async function flush(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
  });
}

type LoaderHandle = Readonly<{
  current: UseWorkspaceLoaderResult;
  rerender: (options: UseWorkspaceLoaderOptions) => void;
  unmount: () => void;
}>;

function renderLoader(options: UseWorkspaceLoaderOptions): LoaderHandle {
  const container = document.createElement("div");
  const root = createRoot(container);
  const result = {
    current: undefined as unknown as UseWorkspaceLoaderResult,
  };

  function TestComponent(
    props: Readonly<{ options: UseWorkspaceLoaderOptions }>,
  ): null {
    result.current = useWorkspaceLoader(props.options);
    return null;
  }

  function Wrapper(props: Readonly<{ children: ReactNode }>): ReactNode {
    return <WorkspaceProvider>{props.children}</WorkspaceProvider>;
  }

  act(() => {
    root.render(
      <Wrapper>
        <TestComponent options={options} />
      </Wrapper>,
    );
  });

  return {
    get current() {
      return result.current;
    },
    rerender: (next) => {
      act(() => {
        root.render(
          <Wrapper>
            <TestComponent options={next} />
          </Wrapper>,
        );
      });
    },
    unmount: () => {
      act(() => {
        root.unmount();
      });
    },
  };
}

test("初期状態のstate3個とselector導出", () => {
  const hook = renderLoader({
    onError: vi.fn(),
    workspace: fakeWorkspace(openedState("/workspace")),
    commands: defaultCommands(),
  });

  expect(hook.current.state.workspaceInput).toBe("");
  expect(hook.current.state.isBrowsingWorkspace).toBe(false);
  expect(hook.current.state.dropErrorMessage).toBeNull();
  expect(hook.current.state.activeWorkspaceRoot).toBe("/workspace");
  expect(hook.current.state.isWorkspaceOpening).toBe(false);
  expect(hook.current.state.workspaceErrorMessage).toBeNull();
  hook.unmount();
});

test("io.loadラッパーはload開始前にクリア+input更新しonWorkspaceLoadedをpre-bindする", async () => {
  const loadDeferred = deferred<boolean>();
  const loadOptions: { onWorkspaceLoaded?: unknown; preserve?: unknown } = {};
  const load = vi.fn((_path: WorkspacePath, options?: LoadWorkspaceOptions) => {
    loadOptions.onWorkspaceLoaded = options?.onWorkspaceLoaded;
    loadOptions.preserve = options?.preserveCurrentWorkspace;
    return loadDeferred.promise;
  });
  const onError = vi.fn();
  const hook = renderLoader({
    onError,
    workspace: fakeWorkspace(idleState(), { load }),
    commands: defaultCommands(),
  });

  act(() => {
    hook.current.actions.setWorkspaceInput("/typed");
  });
  act(() => {
    hook.current.actions.loadWorkspace();
  });

  expect(onError).toHaveBeenCalledWith(null);
  expect(hook.current.state.dropErrorMessage).toBeNull();
  expect(hook.current.state.workspaceInput).toBe("/typed");
  expect(typeof loadOptions.onWorkspaceLoaded).toBe("function");
  expect(loadOptions.preserve).toBe(false);

  loadDeferred.resolve(true);
  await flush();
  hook.unmount();
});

test("io.validateラッパーの2段クリア（validate pending中に書いたdropエラーがload直前に消える）", async () => {
  const validateDeferred = deferred<{ isDirectory: boolean }>();
  const commands = {
    selectWorkspaceDirectory: vi.fn(async () => "/selected"),
    validateWorkspaceDirectory: vi.fn(() => validateDeferred.promise),
  };
  let dropHandler: ((event: WorkspaceDragDropEvent) => void) | null = null;
  const subscribeDragDropEvents: SubscribeWorkspaceDragDropEvents = vi.fn(
    async (handler) => {
      dropHandler = handler;
      return vi.fn();
    },
  );
  const hook = renderLoader({
    onError: vi.fn(),
    workspace: fakeWorkspace(idleState()),
    commands,
    subscribeDragDropEvents,
  });
  await flush();

  act(() => {
    void hook.current.actions.openRecentWorkspacePath(
      workspacePathFixture("/recent"),
    );
  });
  expect(hook.current.state.workspaceInput).toBe("/recent");

  act(() => {
    dropHandler?.({ type: "drop", paths: ["/a", "/b"] });
  });
  expect(hook.current.state.dropErrorMessage).not.toBeNull();

  validateDeferred.resolve({ isDirectory: true });
  await flush();

  expect(hook.current.state.dropErrorMessage).toBeNull();
  hook.unmount();
});

test("browseアダプタはダイアログ表示中にbrowsingフラグをtrueにする", async () => {
  const dialog = deferred<string | null>();
  const commands = {
    selectWorkspaceDirectory: vi.fn(() => dialog.promise),
    validateWorkspaceDirectory: vi.fn(async () => ({ isDirectory: true })),
  };
  const load = vi.fn(async () => true);
  const hook = renderLoader({
    onError: vi.fn(),
    workspace: fakeWorkspace(idleState(), { load }),
    commands,
  });

  act(() => {
    void hook.current.actions.browseWorkspace();
  });
  expect(hook.current.state.isBrowsingWorkspace).toBe(true);

  dialog.resolve("/browsed");
  await flush();

  expect(hook.current.state.isBrowsingWorkspace).toBe(false);
  expect(load).toHaveBeenCalledWith("/browsed", expect.anything());
  expect(hook.current.state.workspaceInput).toBe("/browsed");
  hook.unmount();
});

test("browseアダプタはダイアログのfile URLをcanonical pathへ変換する", async () => {
  const load = vi.fn(async () => true);
  const hook = renderLoader({
    onError: vi.fn(),
    workspace: fakeWorkspace(idleState(), { load }),
    commands: {
      selectWorkspaceDirectory: vi.fn(
        async () => "file:///workspace/spec%20viewer/",
      ),
      validateWorkspaceDirectory: vi.fn(async () => ({ isDirectory: true })),
    },
  });

  await act(async () => {
    await hook.current.actions.browseWorkspace();
  });

  expect(load).toHaveBeenCalledWith(
    workspacePathFixture("/workspace/spec viewer"),
    expect.anything(),
  );
  expect(hook.current.state.workspaceInput).toBe("/workspace/spec viewer");
  hook.unmount();
});

test("browseアダプタはキャンセル（null）でloadせずbrowsingをfalseへ戻す", async () => {
  const commands = {
    selectWorkspaceDirectory: vi.fn(async () => null),
    validateWorkspaceDirectory: vi.fn(async () => ({ isDirectory: true })),
  };
  const load = vi.fn(async () => true);
  const onError = vi.fn();
  const hook = renderLoader({
    onError,
    workspace: fakeWorkspace(idleState(), { load }),
    commands,
  });

  await act(async () => {
    await hook.current.actions.browseWorkspace();
  });

  expect(load).not.toHaveBeenCalled();
  expect(hook.current.state.isBrowsingWorkspace).toBe(false);
  hook.unmount();
});

test("browseアダプタはダイアログ例外でonErrorへメッセージを渡しbrowsingを戻す", async () => {
  const failure = new Error("dialog boom");
  const commands = {
    selectWorkspaceDirectory: vi.fn(async () => {
      throw failure;
    }),
    validateWorkspaceDirectory: vi.fn(async () => ({ isDirectory: true })),
  };
  const onError = vi.fn();
  const hook = renderLoader({
    onError,
    workspace: fakeWorkspace(idleState()),
    commands,
  });

  await act(async () => {
    await hook.current.actions.browseWorkspace();
  });

  expect(onError).toHaveBeenCalledWith(getUnknownErrorMessage(failure));
  expect(hook.current.state.isBrowsingWorkspace).toBe(false);
  hook.unmount();
});

test("browseアダプタはopening中ならダイアログコマンドを呼ばない", async () => {
  const commands = defaultCommands();
  const hook = renderLoader({
    onError: vi.fn(),
    workspace: fakeWorkspace(openingState()),
    commands,
  });

  await act(async () => {
    await hook.current.actions.browseWorkspace();
  });

  expect(commands.selectWorkspaceDirectory).not.toHaveBeenCalled();
  expect(hook.current.state.isBrowsingWorkspace).toBe(false);
  hook.unmount();
});

test("手入力アダプタは現在のworkspaceInput stateの値をloadへ渡す", async () => {
  const load = vi.fn(async () => true);
  const hook = renderLoader({
    onError: vi.fn(),
    workspace: fakeWorkspace(idleState(), { load }),
    commands: defaultCommands(),
  });

  act(() => {
    hook.current.actions.setWorkspaceInput("/path");
  });
  await act(async () => {
    hook.current.actions.loadWorkspace();
    await Promise.resolve();
  });

  expect(load).toHaveBeenCalledWith("/path", expect.anything());
  hook.unmount();
});

test("recent失敗outcomeは一覧削除→onError→input rollbackの順で適用される", async () => {
  const commands = {
    selectWorkspaceDirectory: vi.fn(async () => "/selected"),
    validateWorkspaceDirectory: vi.fn(async () => ({ isDirectory: false })),
  };
  const onError = vi.fn();
  const storage = new MemoryStorage();
  const hook = renderLoader({
    onError,
    workspace: fakeWorkspace(openedState("/active")),
    commands,
    recentWorkspacesStorage: storage,
  });

  await act(async () => {
    await hook.current.actions.openRecentWorkspacePath(
      workspacePathFixture("/recent"),
    );
  });

  expect(onError).toHaveBeenCalledWith(
    "ワークスペースが見つかりません。保存済み一覧から削除しました。",
  );
  expect(hook.current.state.workspaceInput).toBe("/active");
  hook.unmount();
});

test("drop失敗outcomeはdropErrorMessageへ固定文言を設定する", async () => {
  const commands = {
    selectWorkspaceDirectory: vi.fn(async () => "/selected"),
    validateWorkspaceDirectory: vi.fn(async () => ({ isDirectory: false })),
  };
  let dropHandler: ((event: WorkspaceDragDropEvent) => void) | null = null;
  const subscribeDragDropEvents: SubscribeWorkspaceDragDropEvents = vi.fn(
    async (handler) => {
      dropHandler = handler;
      return vi.fn();
    },
  );
  const hook = renderLoader({
    onError: vi.fn(),
    workspace: fakeWorkspace(idleState()),
    commands,
    subscribeDragDropEvents,
  });
  await flush();

  act(() => {
    dropHandler?.({ type: "drop", paths: ["/workspace/spec"] });
  });
  await flush();

  expect(hook.current.state.dropErrorMessage).toBe(
    "ワークスペースフォルダをドロップしてください。ファイルはワークスペースとして開けません。",
  );
  hook.unmount();
});

test("resetアダプタはinput・dropError・onErrorをクリアしresetを1回呼ぶ", () => {
  const reset = vi.fn();
  const onError = vi.fn();
  const hook = renderLoader({
    onError,
    workspace: fakeWorkspace(idleState(), { reset }),
    commands: defaultCommands(),
  });

  act(() => {
    hook.current.actions.setWorkspaceInput("/typed");
  });
  act(() => {
    hook.current.actions.resetWorkspace();
  });

  expect(hook.current.state.workspaceInput).toBe("");
  expect(hook.current.state.dropErrorMessage).toBeNull();
  expect(onError).toHaveBeenLastCalledWith(null);
  expect(reset).toHaveBeenCalledTimes(1);
  hook.unmount();
});

test("recentWorkspacesは所有する単一インスタンスを再露出しrecord/removeが反映される", async () => {
  const storage = new MemoryStorage();
  const load = vi.fn(
    async (path: WorkspacePath, options?: LoadWorkspaceOptions) => {
      options?.onWorkspaceLoaded?.({
        root: path,
        kind: "plugin-workspace",
        files: [],
      });
      return true;
    },
  );
  const hook = renderLoader({
    onError: vi.fn(),
    workspace: fakeWorkspace(idleState(), { load }),
    commands: {
      selectWorkspaceDirectory: vi.fn(async () => "/added"),
      validateWorkspaceDirectory: vi.fn(async () => ({ isDirectory: true })),
    },
    recentWorkspacesStorage: storage,
  });

  act(() => {
    hook.current.actions.setWorkspaceInput("/added");
  });
  await act(async () => {
    hook.current.actions.loadWorkspace();
    await Promise.resolve();
  });

  expect(
    hook.current.recentWorkspaces.recentWorkspaces.some(
      (workspace) => workspace.path === "/added",
    ),
  ).toBe(true);

  act(() => {
    hook.current.recentWorkspaces.removeWorkspace(
      workspacePathFixture("/added"),
    );
  });

  expect(
    hook.current.recentWorkspaces.recentWorkspaces.some(
      (workspace) => workspace.path === "/added",
    ),
  ).toBe(false);
  hook.unmount();
});

test("drop統合: invalid dropでdropErrorMessageが設定される", async () => {
  let dropHandler: ((event: WorkspaceDragDropEvent) => void) | null = null;
  const subscribeDragDropEvents: SubscribeWorkspaceDragDropEvents = vi.fn(
    async (handler) => {
      dropHandler = handler;
      return vi.fn();
    },
  );
  const hook = renderLoader({
    onError: vi.fn(),
    workspace: fakeWorkspace(idleState()),
    commands: defaultCommands(),
    subscribeDragDropEvents,
  });
  await flush();

  act(() => {
    dropHandler?.({ type: "drop", paths: ["/a", "/b"] });
  });

  expect(hook.current.state.dropErrorMessage).not.toBeNull();
  hook.unmount();
});

test("drop統合: draggingでisDraggingWorkspaceがtrueになる", async () => {
  let dropHandler: ((event: WorkspaceDragDropEvent) => void) | null = null;
  const subscribeDragDropEvents: SubscribeWorkspaceDragDropEvents = vi.fn(
    async (handler) => {
      dropHandler = handler;
      return vi.fn();
    },
  );
  const hook = renderLoader({
    onError: vi.fn(),
    workspace: fakeWorkspace(idleState()),
    commands: defaultCommands(),
    subscribeDragDropEvents,
  });
  await flush();

  act(() => {
    dropHandler?.({ type: "enter", paths: ["/workspace"] });
  });

  expect(hook.current.state.isDraggingWorkspace).toBe(true);
  hook.unmount();
});

test("opening中はdropが無効化される", async () => {
  const subscribeDragDropEvents: SubscribeWorkspaceDragDropEvents = vi.fn(
    async () => vi.fn(),
  );
  const hook = renderLoader({
    onError: vi.fn(),
    workspace: fakeWorkspace(openingState()),
    commands: defaultCommands(),
    subscribeDragDropEvents,
  });
  await flush();

  expect(hook.current.state.isDraggingWorkspace).toBe(false);
  hook.unmount();
});

test("startup restoreはvalidate→loadを1回だけ実行しrerenderで再実行しない", async () => {
  const storage = new MemoryStorage();
  writeLastActiveWorkspacePath(workspacePathFixture("/last"), storage);
  const commands = {
    selectWorkspaceDirectory: vi.fn(async () => "/selected"),
    validateWorkspaceDirectory: vi.fn(async () => ({ isDirectory: true })),
  };
  const load = vi.fn(async () => true);
  const options: UseWorkspaceLoaderOptions = {
    onError: vi.fn(),
    workspace: fakeWorkspace(idleState(), { load }),
    commands,
    recentWorkspacesStorage: storage,
  };
  const hook = renderLoader(options);
  await flush();

  expect(commands.validateWorkspaceDirectory).toHaveBeenCalledTimes(1);
  expect(load).toHaveBeenCalledTimes(1);

  hook.rerender(options);
  await flush();

  expect(commands.validateWorkspaceDirectory).toHaveBeenCalledTimes(1);
  hook.unmount();
});

function seededStorage(): MemoryStorage {
  const storage = new MemoryStorage();
  writeLastActiveWorkspacePath(workspacePathFixture("/last"), storage);
  return storage;
}

test.each([
  ["workspace既存", openedState("/existing"), seededStorage],
  ["opening中", openingState(), seededStorage],
  ["lastActiveなし", idleState(), () => new MemoryStorage()],
])("startup restore抑止（%s）ではvalidateが呼ばれない", async (_label, state, makeStorage) => {
  const storage = makeStorage();
  const commands = {
    selectWorkspaceDirectory: vi.fn(async () => "/selected"),
    validateWorkspaceDirectory: vi.fn(async () => ({ isDirectory: true })),
  };
  const hook = renderLoader({
    onError: vi.fn(),
    workspace: fakeWorkspace(state),
    commands,
    recentWorkspacesStorage: storage,
  });
  await flush();

  expect(commands.validateWorkspaceDirectory).not.toHaveBeenCalled();
  hook.unmount();
});
