import { getCurrentWebview } from "@tauri-apps/api/webview";

export type WorkspaceDragDropEvent =
  | Readonly<{
      type: "enter";
      paths: readonly string[];
    }>
  | Readonly<{
      type: "over";
    }>
  | Readonly<{
      type: "drop";
      paths: readonly string[];
    }>
  | Readonly<{
      type: "leave";
    }>;

/** @returns An unlisten function for native Tauri workspace drag-and-drop events. */
export async function subscribeWorkspaceDragDropEvents(
  /**
   * Handles each native workspace drag-and-drop event.
   * @param event - Drag-and-drop event emitted by the webview.
   */
  handler: (event: WorkspaceDragDropEvent) => void,
): Promise<() => void> {
  return getCurrentWebview().onDragDropEvent((event) => {
    handler(event.payload as WorkspaceDragDropEvent);
  });
}
