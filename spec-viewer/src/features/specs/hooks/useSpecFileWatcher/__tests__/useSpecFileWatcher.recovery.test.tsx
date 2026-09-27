import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";

import {
  SpecViewSelection,
  type SpecViewSelection as SpecViewSelectionType,
} from "@/features/specs/domain/specViewSelection";
import {
  type SpecFileWatchSubscriber,
  type StartSpecFileWatchCommand,
  type StopSpecFileWatchCommand,
  type UseSpecFileWatcherOptions,
  useSpecFileWatcher,
} from "@/features/specs/hooks/useSpecFileWatcher";
import type { StartSpecFileWatchResponse } from "@/features/specs/types/watch";
import { WorkspacePath } from "@/domains/workspacePath";
import type { SpecFileWatchNotification } from "@/features/specs/domain/specFileWatchNotification";

type WatcherErrorHandler = NonNullable<
  UseSpecFileWatcherOptions["onWatcherError"]
>;

type WatcherCommands = Readonly<{
  onWatcherError: WatcherErrorHandler;
  startWatch: StartSpecFileWatchCommand;
  stopWatch: StopSpecFileWatchCommand;
}>;

function createSelection(specId: string): SpecViewSelectionType {
  return SpecViewSelection.synchronize(SpecViewSelection.empty(), {
    workspacePath: WorkspacePath.fromString("/workspace"),
    specId,
    fileKey: "impl",
  });
}

function createStartResponse(specId: string): StartSpecFileWatchResponse {
  return {
    workspacePath: "/workspace",
    specId,
    fileKey: "impl",
    strategy: "native",
    watchedPaths: [],
    skippedPaths: [],
    debounceMs: 100,
  };
}

async function flush(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
  });
}

function renderWatcher(commands: WatcherCommands): {
  rerender: (specId: string) => void;
  notify: (notification: SpecFileWatchNotification) => void;
  onMarkdownChange: ReturnType<typeof vi.fn>;
  unmount: () => void;
} {
  const container = document.createElement("div");
  const root = createRoot(container);
  let notify: (notification: SpecFileWatchNotification) => void = () =>
    undefined;
  const subscribe: SpecFileWatchSubscriber = async (handler) => {
    notify = handler;
    return () => undefined;
  };
  const onMarkdownChange = vi.fn();

  function TestComponent({ specId }: Readonly<{ specId: string }>): null {
    useSpecFileWatcher({
      selection: createSelection(specId),
      onMarkdownChange,
      onWatcherError: commands.onWatcherError,
      startWatch: commands.startWatch,
      stopWatch: commands.stopWatch,
      subscribe,
    });
    return null;
  }

  act(() => {
    root.render(<TestComponent specId="spec-a" />);
  });

  return {
    notify: (notification) => {
      notify(notification);
    },
    onMarkdownChange,
    rerender: (specId) => {
      act(() => {
        root.render(<TestComponent specId={specId} />);
      });
    },
    unmount: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

test("start失敗後もqueueを回復して次generationを開始する", async () => {
  const onWatcherError = vi.fn<WatcherErrorHandler>();
  const startedSpecIds: string[] = [];
  const startWatch = vi
    .fn<StartSpecFileWatchCommand>()
    .mockRejectedValueOnce(new Error("spec-a start failed"))
    .mockImplementationOnce(async (request) => {
      startedSpecIds.push(request.specId);
      return createStartResponse(request.specId);
    });
  const stopWatch = vi
    .fn<StopSpecFileWatchCommand>()
    .mockResolvedValue({ stopped: true });
  const watcher = renderWatcher({ onWatcherError, startWatch, stopWatch });
  await flush();

  watcher.rerender("spec-b");
  await flush();
  const requestedSpecIds = startWatch.mock.calls.map(
    ([request]) => request.specId,
  );
  watcher.unmount();
  await flush();

  expect(requestedSpecIds).toEqual(["spec-a", "spec-b"]);
  expect(startedSpecIds).toEqual(["spec-b"]);
  expect(onWatcherError).toHaveBeenCalledWith(
    expect.objectContaining({ message: "spec-a start failed" }),
  );
});

test("監視中の失敗を通知し次の選択で変更通知を処理できる", async () => {
  const onWatcherError = vi.fn<WatcherErrorHandler>();
  const startWatch = vi.fn<StartSpecFileWatchCommand>(async (request) =>
    createStartResponse(request.specId),
  );
  const stopWatch = vi.fn<StopSpecFileWatchCommand>(async () => ({
    stopped: true,
  }));
  const watcher = renderWatcher({ onWatcherError, startWatch, stopWatch });
  await flush();

  act(() => {
    watcher.notify({
      type: "watchFailed",
      scope: {
        workspacePath: WorkspacePath.fromString("/workspace"),
        specId: "spec-a",
        fileKey: "impl",
      },
      message: "watch died",
    });
  });
  expect(onWatcherError).toHaveBeenCalledWith(
    expect.objectContaining({ message: "watch died" }),
  );

  watcher.rerender("spec-b");
  await flush();
  act(() => {
    watcher.notify({
      type: "markdownChanged",
      scope: {
        workspacePath: WorkspacePath.fromString("/workspace"),
        specId: "spec-b",
        fileKey: "impl",
      },
      path: "/workspace/spec-b/impl.md",
    });
  });

  expect(startWatch).toHaveBeenCalledTimes(2);
  expect(watcher.onMarkdownChange).toHaveBeenCalledTimes(1);
  watcher.unmount();
  await flush();
});

test("stop失敗後もqueueを回復して次generationを開始する", async () => {
  const onWatcherError = vi.fn<WatcherErrorHandler>();
  const startedSpecIds: string[] = [];
  const startWatch = vi.fn<StartSpecFileWatchCommand>(async (request) => {
    startedSpecIds.push(request.specId);
    return createStartResponse(request.specId);
  });
  const stopWatch = vi
    .fn<StopSpecFileWatchCommand>()
    .mockRejectedValueOnce(new Error("spec-a stop failed"))
    .mockResolvedValue({ stopped: true });
  const watcher = renderWatcher({ onWatcherError, startWatch, stopWatch });
  await flush();

  watcher.rerender("spec-b");
  await flush();
  watcher.unmount();
  await flush();

  expect(startedSpecIds).toEqual(["spec-a", "spec-b"]);
  expect(stopWatch).toHaveBeenCalledTimes(2);
  expect(onWatcherError).not.toHaveBeenCalled();
});
