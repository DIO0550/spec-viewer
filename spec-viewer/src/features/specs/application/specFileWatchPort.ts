import type { SpecFileWatchNotification } from "@/features/specs/domain/specFileWatchNotification";
import type {
  StartSpecFileWatchRequest,
  StartSpecFileWatchResponse,
  StopSpecFileWatchResponse,
} from "@/features/specs/types/watch";

export type StartSpecFileWatchCommand = (
  request: StartSpecFileWatchRequest,
) => Promise<StartSpecFileWatchResponse>;

export type StopSpecFileWatchCommand = () => Promise<StopSpecFileWatchResponse>;

export type SpecWatchSubscriber = (
  handler: (notification: SpecFileWatchNotification) => void,
) => Promise<() => void>;

export type SpecFileWatchCommands = Readonly<{
  startWatch: StartSpecFileWatchCommand;
  stopWatch: StopSpecFileWatchCommand;
  subscribe: SpecWatchSubscriber;
}>;
