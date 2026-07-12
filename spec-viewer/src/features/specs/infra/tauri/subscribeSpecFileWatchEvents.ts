import { listen } from "@tauri-apps/api/event";

import type { SpecFileWatchSubscriber } from "@/features/specs/application/ports/specFileWatch";

/** @returns An unlisten function for a native spec-file-watch event. */
export const subscribeSpecFileWatchEvents: SpecFileWatchSubscriber = async (
  eventName,
  handler,
) => listen(eventName, handler);
