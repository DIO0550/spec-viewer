import { expect, test, vi } from "vitest";
import type { WorkspaceDropIntent } from "@/features/workspace/domain/workspaceDropIntent";
import { subscribeWorkspaceDragDropEvents } from "@/features/workspace/services/subscribeWorkspaceDragDropEvents";

let emitNativeEvent: (payload: unknown) => void = () => undefined;
const unlisten = vi.fn();

vi.mock("@tauri-apps/api/webview", () => ({
  getCurrentWebview: () => ({
    onDragDropEvent: async (handler: (event: { payload: unknown }) => void) => {
      emitNativeEvent = (payload) => {
        handler({ payload });
      };
      return unlisten;
    },
  }),
}));

test("native の enter、leave、drop をドメイン意図として配送する", async () => {
  const received: WorkspaceDropIntent[] = [];
  const stop = await subscribeWorkspaceDragDropEvents((intent) => {
    received.push(intent);
  });

  emitNativeEvent({ type: "enter", paths: ["/workspace/project"] });
  emitNativeEvent({ type: "leave" });
  emitNativeEvent({ type: "drop", paths: ["/workspace/project"] });

  expect(received).toEqual([
    { type: "enter" },
    { type: "leave" },
    { type: "drop", paths: ["/workspace/project"] },
  ]);
  stop();
  expect(unlisten).toHaveBeenCalledOnce();
});

test.each([
  null,
  { type: "over" },
  { type: "unknown" },
  { type: "drop", paths: [1] },
  { type: "enter", paths: "bad" },
  { type: "drop" },
])("不正または意味のない native payload を配送しない: %#", async (payload) => {
  const received: WorkspaceDropIntent[] = [];
  await subscribeWorkspaceDragDropEvents((intent) => {
    received.push(intent);
  });

  emitNativeEvent(payload);

  expect(received).toEqual([]);
});
