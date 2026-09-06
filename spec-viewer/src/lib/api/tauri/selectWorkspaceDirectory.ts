import { open } from "@tauri-apps/plugin-dialog";

/** @returns The directory selected from the native workspace picker, or null. */
export async function selectWorkspaceDirectory(): Promise<string | null> {
  return open({
    directory: true,
    multiple: false,
    title: "Open workspace",
  });
}
