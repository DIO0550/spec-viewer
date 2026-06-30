import type { StopSpecFileWatchResponse } from "@/features/specs/types/watch";

import { invokeTauriCommand } from "./invokeTauriCommand";

/** @returns Confirmation that the active backend watcher was stopped. */
export async function stopSpecFileWatch(): Promise<StopSpecFileWatchResponse> {
  return invokeTauriCommand("stop_spec_file_watch", {});
}
