import { expect, test, vi } from "vitest";
import type { SpecFileWatchNotification } from "@/features/specs/domain/specFileWatchNotification";
import {
  createSpecWatchSubscriber,
  SPEC_FILE_WATCH_CHANGED_EVENT,
  SPEC_FILE_WATCH_ERROR_EVENT,
  type RawEventSubscriber,
} from "@/features/specs/services/specFileWatchEvents";

const scope = {
  workspacePath: "/workspace/project",
  specId: "auth",
  fileKey: "tasks",
};

function createEventSource(): {
  subscribe: RawEventSubscriber;
  emit: (name: string, payload: unknown) => void;
  unlistenChanged: ReturnType<typeof vi.fn>;
  unlistenError: ReturnType<typeof vi.fn>;
} {
  const handlers = new Map<string, (event: { payload: unknown }) => void>();
  const unlistenChanged = vi.fn();
  const unlistenError = vi.fn();
  const subscribe: RawEventSubscriber = async (name, handler) => {
    handlers.set(name, handler);
    return name === SPEC_FILE_WATCH_CHANGED_EVENT
      ? unlistenChanged
      : unlistenError;
  };

  return {
    subscribe,
    emit(name, payload) {
      handlers.get(name)?.({ payload });
    },
    unlistenChanged,
    unlistenError,
  };
}

test("Markdown と設定変更を別のドメイン通知として配送する", async () => {
  const source = createEventSource();
  const notifications: SpecFileWatchNotification[] = [];
  const unlisten = await createSpecWatchSubscriber(source.subscribe)(
    (notification) => {
      notifications.push(notification);
    },
  );

  source.emit(SPEC_FILE_WATCH_CHANGED_EVENT, {
    ...scope,
    changeKind: "markdown",
    path: "/workspace/project/tasks.md",
  });
  source.emit(SPEC_FILE_WATCH_CHANGED_EVENT, {
    ...scope,
    changeKind: "config",
    path: "/workspace/project/.config.yml",
  });

  expect(notifications.map((notification) => notification.type)).toEqual([
    "markdownChanged",
    "configChanged",
  ]);
  unlisten();
  expect(source.unlistenChanged).toHaveBeenCalledOnce();
  expect(source.unlistenError).toHaveBeenCalledOnce();
});

test("監視失敗をドメイン通知として配送する", async () => {
  const source = createEventSource();
  const notifications: SpecFileWatchNotification[] = [];
  await createSpecWatchSubscriber(source.subscribe)((notification) => {
    notifications.push(notification);
  });

  source.emit(SPEC_FILE_WATCH_ERROR_EVENT, {
    ...scope,
    message: "permission denied",
  });

  expect(notifications).toMatchObject([
    { type: "watchFailed", message: "permission denied" },
  ]);
});

test.each([
  null,
  { ...scope, changeKind: "markdown", path: "" },
  { ...scope, changeKind: "markdown", path: "/tasks.md", fileKey: "unknown" },
  { ...scope, changeKind: "unknown", path: "/tasks.md" },
  { ...scope, changeKind: "markdown", path: "/tasks.md", specId: "" },
  { ...scope, changeKind: "markdown", path: "/tasks.md", workspacePath: "" },
])("不正な変更 payload を配送しない: %#", async (payload) => {
  const source = createEventSource();
  const notifications: SpecFileWatchNotification[] = [];
  await createSpecWatchSubscriber(source.subscribe)((notification) => {
    notifications.push(notification);
  });

  source.emit(SPEC_FILE_WATCH_CHANGED_EVENT, payload);

  expect(notifications).toEqual([]);
});

test("二つ目の購読失敗時に最初の購読を解除する", async () => {
  const unlistenChanged = vi.fn();
  const subscribe: RawEventSubscriber = async (name) => {
    if (name === SPEC_FILE_WATCH_ERROR_EVENT) {
      throw new Error("listener failed");
    }

    return unlistenChanged;
  };

  await expect(createSpecWatchSubscriber(subscribe)(vi.fn())).rejects.toThrow(
    "listener failed",
  );
  expect(unlistenChanged).toHaveBeenCalledOnce();
});
