import type { Event as TauriEvent } from "@tauri-apps/api/event";
import { act, useLayoutEffect } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import {
  type UseViewRefreshOptions,
  useViewRefresh,
} from "@/app/App/hooks/useViewRefresh";
import type {
  SpecFileWatchSubscriber,
  StartSpecFileWatchCommand,
  StopSpecFileWatchCommand,
} from "@/features/specs";
import {
  SPEC_FILE_WATCH_CHANGED_EVENT,
  SPEC_FILE_WATCH_ERROR_EVENT,
  type SpecFileWatchChangeKind,
} from "@/features/specs/types/watch";
import { SpecViewSelection } from "@/shared/domain/specViewSelection";
import { WorkspacePath } from "@/shared/domain/workspacePath";
import { getUnknownErrorMessage } from "@/shared/lib/errorMessage";

const workspacePath = WorkspacePath.fromString("/workspace");
const selection = SpecViewSelection.synchronize(SpecViewSelection.empty(), {
  workspacePath,
  specId: "spec-1",
  fileKey: "impl",
});

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
  rerenderBeforePassiveEffects: (
    next: UseViewRefreshOptions,
    beforePassiveEffects: () => void,
  ) => Promise<void>;
  unmount: () => void;
} {
  const container = document.createElement("div");
  const root = createRoot(container);
  const result = {
    current: undefined as unknown as ReturnType<typeof useViewRefresh>,
  };
  const commitCallbacks: Array<() => void> = [];

  function TestComponent(
    props: Readonly<{ options: UseViewRefreshOptions }>,
  ): null {
    result.current = useViewRefresh(props.options);
    useLayoutEffect(() => {
      commitCallbacks.shift()?.();
    });
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
    rerenderBeforePassiveEffects: (next, beforePassiveEffects) =>
      new Promise<void>((resolve) => {
        commitCallbacks.push(() => {
          beforePassiveEffects();
          resolve();
        });
        root.render(<TestComponent options={next} />);
      }),
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
  ["workspace未選択", SpecViewSelection.empty(), false],
  [
    "spec未選択",
    SpecViewSelection.selectWorkspace(SpecViewSelection.empty(), workspacePath),
    false,
  ],
  [
    "file未選択",
    SpecViewSelection.selectSpec(
      SpecViewSelection.selectWorkspace(
        SpecViewSelection.empty(),
        workspacePath,
      ),
      "spec-1",
    ),
    false,
  ],
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

test("selection変更commit後のpassive effect前に旧watch eventを受けてもreloadしない", async () => {
  const handlers: WatchHandlers = new Map();
  const reload = createReload();
  const watcher = createWatcher(handlers);
  const hook = renderHook({
    selection,
    isCurrentViewLoading: false,
    reload,
    onError: vi.fn(),
    watcher,
  });
  await flush();
  const previousChangedHandler = handlers.get(SPEC_FILE_WATCH_CHANGED_EVENT);
  const nextSelection = SpecViewSelection.synchronize(
    SpecViewSelection.empty(),
    {
      workspacePath,
      specId: "spec-2",
      fileKey: "impl",
    },
  );

  await hook.rerenderBeforePassiveEffects(
    {
      selection: nextSelection,
      isCurrentViewLoading: false,
      reload,
      onError: vi.fn(),
      watcher,
    },
    () => {
      previousChangedHandler?.({
        payload: {
          workspacePath: "/workspace",
          specId: "spec-1",
          fileKey: "impl",
          changeKind: "markdown",
          path: "/workspace/spec-1/impl.md",
        },
      } as TauriEvent<unknown>);
    },
  );
  await flush();

  expect(reload.document).not.toHaveBeenCalled();
  expect(reload.comments).not.toHaveBeenCalled();
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
