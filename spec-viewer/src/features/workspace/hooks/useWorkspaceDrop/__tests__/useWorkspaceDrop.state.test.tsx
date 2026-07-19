import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";

import type { WorkspaceDragDropEvent } from "@/lib/api/tauri";
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
  let dragDropHandler: ((event: WorkspaceDragDropEvent) => void) | null = null;
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
    dragDropHandler?.({ type: "enter", paths: ["/workspace/spec-reviewer"] });
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
  let dragDropHandler: ((event: WorkspaceDragDropEvent) => void) | null = null;
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
