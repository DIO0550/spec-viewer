import { getCurrentWebview } from "@tauri-apps/api/webview";
import { open } from "@tauri-apps/plugin-dialog";

import type { Workspace } from "@/features/workspace/types/workspace";

import { invokeCommand } from "./invokeCommand";

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

/** @returns The directory selected from the native workspace picker, or null. */
export async function selectWorkspaceDirectory(): Promise<string | null> {
  return open({
    directory: true,
    multiple: false,
    title: "Open workspace",
  });
}

/**
 * @param selectedDirectory - Directory chosen by the user.
 * @returns Loaded workspace metadata for the selected directory.
 */
export async function loadWorkspace(
  selectedDirectory: string,
): Promise<Workspace> {
  return invokeCommand("load_workspace", { selectedDirectory });
}

/**
 * @param path - Candidate workspace path.
 * @returns Whether the given path points to an existing directory.
 */
export async function validateWorkspaceDirectory(
  path: string,
): Promise<Readonly<{ isDirectory: boolean }>> {
  return invokeCommand("validate_workspace_directory", { path });
}

/**
 * @param handler - Callback invoked for every native drag-and-drop event.
 * @returns An unlisten function for native Tauri workspace drag-and-drop events.
 */
export async function subscribeWorkspaceDragDropEvents(
  handler: (event: WorkspaceDragDropEvent) => void,
): Promise<() => void> {
  return getCurrentWebview().onDragDropEvent((event) => {
    handler(event.payload as WorkspaceDragDropEvent);
  });
}
