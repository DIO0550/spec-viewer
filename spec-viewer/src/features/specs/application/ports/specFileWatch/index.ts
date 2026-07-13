import type {
  SpecFileWatchChangedEvent,
  SpecFileWatchErrorEvent,
  StartSpecFileWatchRequest,
  StartSpecFileWatchResponse,
  StopSpecFileWatchResponse,
} from "@/features/specs/types/watch";
import {
  SPEC_FILE_WATCH_CHANGED_EVENT,
  SPEC_FILE_WATCH_ERROR_EVENT,
} from "@/features/specs/types/watch";

export type StartSpecFileWatchCommand = (
  request: StartSpecFileWatchRequest,
) => Promise<StartSpecFileWatchResponse>;

export type StopSpecFileWatchCommand = () => Promise<StopSpecFileWatchResponse>;

export type SpecFileWatchSubscription =
  | Readonly<{
      eventName: typeof SPEC_FILE_WATCH_CHANGED_EVENT;
      handler: (
        event: Readonly<{ payload: SpecFileWatchChangedEvent }>,
      ) => void;
    }>
  | Readonly<{
      eventName: typeof SPEC_FILE_WATCH_ERROR_EVENT;
      handler: (event: Readonly<{ payload: SpecFileWatchErrorEvent }>) => void;
    }>;

export type SpecFileWatchSubscriber = (
  subscription: SpecFileWatchSubscription,
) => Promise<() => void>;
