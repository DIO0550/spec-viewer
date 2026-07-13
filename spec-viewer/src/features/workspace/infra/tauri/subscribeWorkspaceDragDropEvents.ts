import { getCurrentWebview } from "@tauri-apps/api/webview";

import type { WorkspaceDragDropEvent } from "@/features/workspace/application/ports/workspaceDragDrop";
import { decodeWorkspaceDragDropEvent } from "@/features/workspace/infra/tauri/workspaceIpcCodec";

/** @returns An unlisten function for native Tauri workspace drag-and-drop events. */
export async function subscribeWorkspaceDragDropEvents(
  /**
   * Handles each native workspace drag-and-drop event.
   * @param event - Drag-and-drop event emitted by the webview.
   */
  handler: (event: WorkspaceDragDropEvent) => void,
): Promise<() => void> {
  return getCurrentWebview().onDragDropEvent((event) => {
    handler(decodeWorkspaceDragDropEvent(event.payload));
  });
}
