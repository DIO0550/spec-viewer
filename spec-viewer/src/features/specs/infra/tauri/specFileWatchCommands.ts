import type { SpecFileWatchCommands } from "@/features/specs/application/specFileWatchPort";
import { subscribeToSpecFileWatch } from "./specFileWatchEvents";
import { startSpecFileWatch } from "./startSpecFileWatch";
import { stopSpecFileWatch } from "./stopSpecFileWatch";

export const specFileWatchCommands: SpecFileWatchCommands = {
  startWatch: startSpecFileWatch,
  stopWatch: stopSpecFileWatch,
  subscribe: subscribeToSpecFileWatch,
};
