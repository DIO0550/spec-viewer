import { getCurrentWebview } from "@tauri-apps/api/webview";
import type { WorkspaceDropIntent } from "@/features/workspace/domain/workspaceDropIntent";
import { isRecord } from "@/lib/api/tauri/isRecord";

function decodeNativeWorkspaceDrop(
  payload: unknown,
): WorkspaceDropIntent | null {
  if (!isRecord(payload)) {
    return null;
  }

  if (payload.type === "leave") {
    return { type: "leave" };
  }

  if (payload.type !== "enter" && payload.type !== "drop") {
    return null;
  }

  const paths: unknown = payload.paths;
  if (
    !Array.isArray(paths) ||
    !paths.every((path: unknown) => typeof path === "string")
  ) {
    return null;
  }

  if (payload.type === "enter") {
    return { type: "enter" };
  }

  return { type: "drop", paths };
}

/** @returns An unlisten function for native Tauri workspace drag-and-drop events. */
export async function subscribeWorkspaceDragDropEvents(
  /**
   * Handles each native workspace drag-and-drop event.
   * @param event - Drag-and-drop event emitted by the webview.
   */
  handler: (event: WorkspaceDropIntent) => void,
): Promise<() => void> {
  return getCurrentWebview().onDragDropEvent((event) => {
    const intent = decodeNativeWorkspaceDrop(event.payload);
    if (intent !== null) {
      handler(intent);
    }
  });
}
