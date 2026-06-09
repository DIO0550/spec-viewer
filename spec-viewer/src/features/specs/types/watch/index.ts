import type { SpecFileKey } from "@/features/specs/types/spec";

export const SPEC_FILE_WATCH_CHANGED_EVENT = "spec-file-watch://changed";
export const SPEC_FILE_WATCH_ERROR_EVENT = "spec-file-watch://error";

export type SpecFileWatchChangeKind = "markdown" | "config";

export type StartSpecFileWatchRequest = Readonly<{
  workspacePath: string;
  specId: string;
  fileKey: SpecFileKey;
}>;

export type StartSpecFileWatchResponse = Readonly<{
  workspacePath: string;
  specId: string;
  fileKey: SpecFileKey;
  strategy: string;
  watchedPaths: readonly string[];
  skippedPaths: readonly string[];
  debounceMs: number;
}>;

export type StopSpecFileWatchRequest = Readonly<Record<string, never>>;

export type StopSpecFileWatchResponse = Readonly<{
  stopped: boolean;
}>;

export type SpecFileWatchChangedEvent = Readonly<{
  workspacePath: string;
  specId: string;
  fileKey: SpecFileKey;
  changeKind: SpecFileWatchChangeKind;
  path: string;
}>;

export type SpecFileWatchErrorEvent = Readonly<{
  workspacePath: string;
  specId: string;
  fileKey: SpecFileKey;
  message: string;
}>;
