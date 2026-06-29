import type {
  StartSpecFileWatchRequest,
  StartSpecFileWatchResponse,
} from "@/features/specs/types/watch";

import { invokeTauriCommand } from "./invokeTauriCommand";

/** @returns Backend watcher registration metadata for the selected spec file. */
export async function startSpecFileWatch(
  request: StartSpecFileWatchRequest,
): Promise<StartSpecFileWatchResponse> {
  return invokeTauriCommand("start_spec_file_watch", request);
}
