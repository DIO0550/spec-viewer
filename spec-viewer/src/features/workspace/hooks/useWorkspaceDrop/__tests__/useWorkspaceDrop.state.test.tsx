import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";

import type { WorkspaceDropIntent } from "@/features/workspace/domain/workspaceDropIntent";
import {
  type SubscribeWorkspaceDragDropEvents,
  useWorkspaceDrop,
} from "@/features/workspace/hooks/useWorkspaceDrop";

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

test("useWorkspaceDropはTauri drop pathをworkspace openへ渡す", async () => {
  let dragDropHandler: ((event: WorkspaceDropIntent) => void) | null = null;
  const onDropWorkspacePath = vi.fn();
  const subscribeDragDropEvents: SubscribeWorkspaceDragDropEvents = vi.fn(
    async (handler) => {
      dragDropHandler = handler;
      return vi.fn();
    },
  );
  const result = renderHook(() =>
    useWorkspaceDrop({
      isDisabled: false,
      onDropWorkspacePath,
      onInvalidDrop: vi.fn(),
      subscribeDragDropEvents,
    }),
  );

  await act(async () => {
    await Promise.resolve();
  });

  act(() => {
    dragDropHandler?.({ type: "enter" });
  });

  expect(result.current.status).toBe("dragging");

  act(() => {
    dragDropHandler?.({ type: "drop", paths: ["/workspace/spec-reviewer"] });
  });

  expect(onDropWorkspacePath).toHaveBeenCalledWith("/workspace/spec-reviewer");
  expect(result.current.status).toBe("idle");
  result.unmount();
});

test("useWorkspaceDropは複数pathのdropをinvalidとして通知する", async () => {
  let dragDropHandler: ((event: WorkspaceDropIntent) => void) | null = null;
  const onInvalidDrop = vi.fn();
  const subscribeDragDropEvents: SubscribeWorkspaceDragDropEvents = vi.fn(
    async (handler) => {
      dragDropHandler = handler;
      return vi.fn();
    },
  );
  const result = renderHook(() =>
    useWorkspaceDrop({
      isDisabled: false,
      onDropWorkspacePath: vi.fn(),
      onInvalidDrop,
      subscribeDragDropEvents,
    }),
  );

  await act(async () => {
    await Promise.resolve();
  });

  act(() => {
    dragDropHandler?.({
      type: "drop",
      paths: ["/workspace/one", "/workspace/two"],
    });
  });

  expect(onInvalidDrop).toHaveBeenCalledWith("Drop a single workspace folder.");
  expect(result.current.status).toBe("idle");
  result.unmount();
});

test("native の enter、leave、無効 drop で表示状態を戻す", async () => {
  let dragDropHandler: ((event: WorkspaceDropIntent) => void) | null = null;
  const onInvalidDrop = vi.fn();
  const result = renderHook(() =>
    useWorkspaceDrop({
      isDisabled: false,
      onDropWorkspacePath: vi.fn(),
      onInvalidDrop,
      subscribeDragDropEvents: async (handler) => {
        dragDropHandler = handler;
        return () => undefined;
      },
    }),
  );

  await act(async () => {
    await Promise.resolve();
  });

  act(() => {
    dragDropHandler?.({ type: "enter" });
  });
  expect(result.current.status).toBe("dragging");

  act(() => {
    dragDropHandler?.({ type: "leave" });
  });
  expect(result.current.status).toBe("idle");

  act(() => {
    dragDropHandler?.({ type: "enter" });
    dragDropHandler?.({ type: "drop", paths: [] });
  });
  expect(result.current.status).toBe("idle");
  expect(onInvalidDrop).toHaveBeenCalledWith(
    "Drop a workspace folder or paste a filesystem path.",
  );
  result.unmount();
});

test("browser の入れ子 drag は最後の leave まで表示を維持し drop で開く", () => {
  const onDropWorkspacePath = vi.fn();
  const result = renderHook(() =>
    useWorkspaceDrop({
      isDisabled: false,
      onDropWorkspacePath,
      onInvalidDrop: vi.fn(),
      subscribeDragDropEvents: async () => () => undefined,
    }),
  );

  act(() => {
    document.dispatchEvent(new Event("dragenter", { cancelable: true }));
    document.dispatchEvent(new Event("dragenter", { cancelable: true }));
    document.dispatchEvent(new Event("dragleave", { cancelable: true }));
  });
  expect(result.current.status).toBe("dragging");

  act(() => {
    document.dispatchEvent(new Event("dragleave", { cancelable: true }));
  });
  expect(result.current.status).toBe("idle");

  const dropEvent = new Event("drop", { cancelable: true });
  Object.defineProperty(dropEvent, "dataTransfer", {
    value: { getData: () => "/workspace/project", files: [] },
  });
  act(() => {
    document.dispatchEvent(new Event("dragenter", { cancelable: true }));
    document.dispatchEvent(dropEvent);
  });

  expect(result.current.status).toBe("idle");
  expect(onDropWorkspacePath).toHaveBeenCalledWith("/workspace/project");
  result.unmount();
});
