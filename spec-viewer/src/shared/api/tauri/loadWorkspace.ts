import type { Workspace } from "@/features/workspace/types/workspace";

import { invokeTauriCommand } from "./invokeTauriCommand";

/** @returns Loaded workspace metadata for the selected directory. */
export async function loadWorkspace(
  selectedDirectory: string,
): Promise<Workspace> {
  return invokeTauriCommand("load_workspace", { selectedDirectory });
}
