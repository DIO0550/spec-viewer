import type {
  StartSpecFileWatchRequest,
  StartSpecFileWatchResponse,
  StopSpecFileWatchResponse,
} from "@/features/specs/types/watch";

export type StartSpecFileWatchCommand = (
  request: StartSpecFileWatchRequest,
) => Promise<StartSpecFileWatchResponse>;

export type StopSpecFileWatchCommand = () => Promise<StopSpecFileWatchResponse>;

export type SpecFileWatchSubscriber = <Payload>(
  eventName: string,
  /** Handles a received event. @param event - Event carrying the decoded payload. */
  handler: (event: Readonly<{ payload: Payload }>) => void,
) => Promise<() => void>;
