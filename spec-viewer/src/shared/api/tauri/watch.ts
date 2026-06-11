import type {
  StartSpecFileWatchRequest,
  StartSpecFileWatchResponse,
  StopSpecFileWatchResponse,
} from "@/features/specs/types/watch";

import { invokeCommand } from "./invokeCommand";

/**
 * @param request - Spec file to watch for backend change events.
 * @returns Backend watcher registration metadata for the selected spec file.
 */
export async function startSpecFileWatch(
  request: StartSpecFileWatchRequest,
): Promise<StartSpecFileWatchResponse> {
  return invokeCommand("start_spec_file_watch", request);
}

/** @returns Confirmation that the active backend watcher was stopped. */
export async function stopSpecFileWatch(): Promise<StopSpecFileWatchResponse> {
  return invokeCommand("stop_spec_file_watch", {});
}
