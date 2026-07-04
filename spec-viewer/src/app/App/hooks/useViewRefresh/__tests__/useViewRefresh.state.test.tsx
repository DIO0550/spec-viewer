import type { Event as TauriEvent } from "@tauri-apps/api/event";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import type { SpecViewResetKeys } from "@/app/App/hooks/types";
import {
  type UseViewRefreshOptions,
  useViewRefresh,
} from "@/app/App/hooks/useViewRefresh";
import type {
  SpecFileWatchSubscriber,
  StartSpecFileWatchCommand,
  StopSpecFileWatchCommand,
} from "@/features/specs/hooks/useSpecFileWatcher";
import {
  SPEC_FILE_WATCH_CHANGED_EVENT,
  SPEC_FILE_WATCH_ERROR_EVENT,
  type SpecFileWatchChangeKind,
} from "@/features/specs/types/watch";
import { getUnknownErrorMessage } from "@/shared/lib/errorMessage";

const selection: SpecViewResetKeys = {
  workspaceRoot: "/workspace",
  specId: "spec-1",
  fileKey: "impl",
};

const startResponse = {
  workspacePath: "/workspace",
  specId: "spec-1",
  fileKey: "impl" as const,
  strategy: "native",
  watchedPaths: [],
  skippedPaths: [],
  debounceMs: 100,
};

type WatchHandlers = Map<string, (event: TauriEvent<unknown>) => void>;

function createWatcher(handlers: WatchHandlers): {
  startWatch: StartSpecFileWatchCommand;
  stopWatch: StopSpecFileWatchCommand;
  subscribe: SpecFileWatchSubscriber;
} {
  const subscribe = vi.fn(async (eventName, handler) => {
    handlers.set(eventName, handler as (event: TauriEvent<unknown>) => void);
    return vi.fn();
  }) as unknown as SpecFileWatchSubscriber;

  return {
    startWatch: vi.fn(async () => startResponse),
    stopWatch: vi.fn(async () => ({ stopped: true })),
    subscribe,
  };
}

async function flush(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
  });
}

function renderHook(options: UseViewRefreshOptions): {
  current: () => ReturnType<typeof useViewRefresh>;
  rerender: (next: UseViewRefreshOptions) => void;
  unmount: () => void;
} {
  const container = document.createElement("div");
  const root = createRoot(container);
  const result = {
    current: undefined as unknown as ReturnType<typeof useViewRefresh>,
  };

  function TestComponent(
    props: Readonly<{ options: UseViewRefreshOptions }>,
  ): null {
    result.current = useViewRefresh(props.options);
    return null;
  }

  act(() => {
    root.render(<TestComponent options={options} />);
  });

  return {
    current: () => result.current,
    rerender: (next) => {
      act(() => {
        root.render(<TestComponent options={next} />);
      });
    },
    unmount: () => {
      act(() => {
        root.unmount();
      });
    },
  };
}

function createReload(
  overrides: Partial<UseViewRefreshOptions["reload"]> = {},
) {
  return {
    document: vi.fn(async () => true),
    specs: vi.fn(async () => true),
    comments: vi.fn(async () => true),
    ...overrides,
  };
}

function fireChanged(
  handlers: WatchHandlers,
  changeKind: SpecFileWatchChangeKind,
): void {
  act(() => {
    handlers.get(SPEC_FILE_WATCH_CHANGED_EVENT)?.({
      payload: {
        workspacePath: "/workspace",
        specId: "spec-1",
        fileKey: "impl",
        changeKind,
        path: "/workspace/spec-1/impl.md",
      },
    } as TauriEvent<unknown>);
  });
}

test("手動リフレッシュ成功でreloadSpecsとreloadCommentsが実行されonErrorはnullのみ", async () => {
  const onError = vi.fn();
  const reload = createReload();
  const hook = renderHook({
    selection,
    isCurrentViewLoading: false,
    reload,
    onError,
    watcher: createWatcher(new Map()),
  });

  await act(async () => {
    await hook.current().refreshCurrentViewManually();
  });

  expect(reload.specs).toHaveBeenCalledTimes(1);
  expect(reload.comments).toHaveBeenCalledTimes(1);
  expect(onError).toHaveBeenCalledTimes(1);
  expect(onError).toHaveBeenCalledWith(null);
  hook.unmount();
});

test("手動リフレッシュがfalseで失敗メッセージがonErrorへ渡る", async () => {
  const onError = vi.fn();
  const reload = createReload({ specs: vi.fn(async () => false) });
  const hook = renderHook({
    selection,
    isCurrentViewLoading: false,
    reload,
    onError,
    watcher: createWatcher(new Map()),
  });

  await act(async () => {
    await hook.current().refreshCurrentViewManually();
  });

  expect(onError).toHaveBeenCalledWith(
    "再読み込みに失敗しました。エラーを確認して再試行してください。",
  );
  hook.unmount();
});

test("手動リフレッシュ例外で連結メッセージがonErrorへ渡る", async () => {
  const failure = new Error("reload boom");
  const onError = vi.fn();
  const reload = createReload({
    specs: vi.fn(async () => {
      throw failure;
    }),
  });
  const hook = renderHook({
    selection,
    isCurrentViewLoading: false,
    reload,
    onError,
    watcher: createWatcher(new Map()),
  });

  await act(async () => {
    await hook.current().refreshCurrentViewManually();
  });

  expect(onError).toHaveBeenCalledWith(
    `再読み込みに失敗しました。エラーを確認して再試行してください。 ${getUnknownErrorMessage(failure)}`,
  );
  hook.unmount();
});

test.each([
  ["workspaceRoot null", { ...selection, workspaceRoot: null }, false],
  ["specId null", { ...selection, specId: null }, false],
  ["fileKey null", { ...selection, fileKey: null }, false],
  ["loading中", selection, true],
])("手動リフレッシュのガード（%s）ではreloadが呼ばれない", async (_label, guardSelection, isLoading) => {
  const reload = createReload();
  const hook = renderHook({
    selection: guardSelection,
    isCurrentViewLoading: isLoading,
    reload,
    onError: vi.fn(),
    watcher: createWatcher(new Map()),
  });

  await act(async () => {
    await hook.current().refreshCurrentViewManually();
  });

  expect(reload.specs).not.toHaveBeenCalled();
  expect(reload.comments).not.toHaveBeenCalled();
  hook.unmount();
});

test("markdown変更でreloadDocumentとreloadCommentsが実行される", async () => {
  const handlers: WatchHandlers = new Map();
  const reload = createReload();
  const hook = renderHook({
    selection,
    isCurrentViewLoading: false,
    reload,
    onError: vi.fn(),
    watcher: createWatcher(handlers),
  });
  await flush();

  fireChanged(handlers, "markdown");
  await flush();

  expect(reload.document).toHaveBeenCalledTimes(1);
  expect(reload.comments).toHaveBeenCalledTimes(1);
  expect(reload.specs).not.toHaveBeenCalled();
  hook.unmount();
});

test("config変更でreloadSpecsとreloadCommentsが実行される", async () => {
  const handlers: WatchHandlers = new Map();
  const reload = createReload();
  const hook = renderHook({
    selection,
    isCurrentViewLoading: false,
    reload,
    onError: vi.fn(),
    watcher: createWatcher(handlers),
  });
  await flush();

  fireChanged(handlers, "config");
  await flush();

  expect(reload.specs).toHaveBeenCalledTimes(1);
  expect(reload.comments).toHaveBeenCalledTimes(1);
  hook.unmount();
});

test("自動再読み込みがfalseで自動失敗メッセージがonErrorへ渡る", async () => {
  const handlers: WatchHandlers = new Map();
  const onError = vi.fn();
  const reload = createReload({ document: vi.fn(async () => false) });
  const hook = renderHook({
    selection,
    isCurrentViewLoading: false,
    reload,
    onError,
    watcher: createWatcher(handlers),
  });
  await flush();

  fireChanged(handlers, "markdown");
  await flush();

  expect(onError).toHaveBeenCalledWith(
    "自動再読み込みに失敗しました。内容が古い可能性があります。",
  );
  hook.unmount();
});

test("loading中はwatcher経由のリロードが抑止される", async () => {
  const handlers: WatchHandlers = new Map();
  const reload = createReload();
  const hook = renderHook({
    selection,
    isCurrentViewLoading: true,
    reload,
    onError: vi.fn(),
    watcher: createWatcher(handlers),
  });
  await flush();

  fireChanged(handlers, "markdown");
  await flush();

  expect(reload.document).not.toHaveBeenCalled();
  hook.unmount();
});

test("watcherエラーイベントで監視失敗メッセージとevent.messageがonErrorへ渡る", async () => {
  const handlers: WatchHandlers = new Map();
  const onError = vi.fn();
  const hook = renderHook({
    selection,
    isCurrentViewLoading: false,
    reload: createReload(),
    onError,
    watcher: createWatcher(handlers),
  });
  await flush();

  act(() => {
    handlers.get(SPEC_FILE_WATCH_ERROR_EVENT)?.({
      payload: {
        workspacePath: "/workspace",
        specId: "spec-1",
        fileKey: "impl",
        message: "watch died",
      },
    } as TauriEvent<unknown>);
  });

  expect(onError).toHaveBeenCalledWith(
    "ファイル監視に失敗しました。内容が古い可能性があります。watch died",
  );
  hook.unmount();
});

test("同一optionsのrerenderで再購読が発生しない", async () => {
  const handlers: WatchHandlers = new Map();
  const watcher = createWatcher(handlers);
  const options: UseViewRefreshOptions = {
    selection,
    isCurrentViewLoading: false,
    reload: createReload(),
    onError: vi.fn(),
    watcher,
  };
  const hook = renderHook(options);
  await flush();

  const subscribeCallsAfterMount = (
    watcher.subscribe as ReturnType<typeof vi.fn>
  ).mock.calls.length;
  const startCallsAfterMount = (watcher.startWatch as ReturnType<typeof vi.fn>)
    .mock.calls.length;

  hook.rerender(options);
  hook.rerender(options);
  await flush();

  expect(
    (watcher.subscribe as ReturnType<typeof vi.fn>).mock.calls.length,
  ).toBe(subscribeCallsAfterMount);
  expect(
    (watcher.startWatch as ReturnType<typeof vi.fn>).mock.calls.length,
  ).toBe(startCallsAfterMount);
  hook.unmount();
});
