import { listen } from "@tauri-apps/api/event";

import type { SpecFileWatchSubscriber } from "@/features/specs/application/ports/specFileWatch";
import {
  decodeSpecFileWatchChangedEvent,
  decodeSpecFileWatchErrorEvent,
} from "@/features/specs/infra/tauri/specIpcCodec";
import {
  SPEC_FILE_WATCH_CHANGED_EVENT,
  SPEC_FILE_WATCH_ERROR_EVENT,
} from "@/features/specs/types/watch";

/** @returns An unlisten function for a decoded native spec-file-watch event. */
export const subscribeSpecFileWatchEvents: SpecFileWatchSubscriber = async (
  subscription,
) => {
  if (subscription.eventName === SPEC_FILE_WATCH_CHANGED_EVENT) {
    return listen<unknown>(subscription.eventName, (event) => {
      subscription.handler({
        payload: decodeSpecFileWatchChangedEvent(event.payload),
      });
    });
  }

  if (subscription.eventName === SPEC_FILE_WATCH_ERROR_EVENT) {
    return listen<unknown>(subscription.eventName, (event) => {
      subscription.handler({
        payload: decodeSpecFileWatchErrorEvent(event.payload),
      });
    });
  }

  throw new Error("Unsupported spec file watch event");
};
