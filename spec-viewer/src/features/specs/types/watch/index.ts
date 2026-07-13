import type { SpecFileKey } from "@/shared/domain/specFileKey";
import type { SpecId } from "@/shared/domain/specId";

export const SPEC_FILE_WATCH_CHANGED_EVENT = "spec-file-watch://changed";
export const SPEC_FILE_WATCH_ERROR_EVENT = "spec-file-watch://error";

export type SpecFileWatchChangeKind = "markdown" | "config";

export type StartSpecFileWatchRequest = Readonly<{
  workspacePath: string;
  specId: SpecId;
  fileKey: SpecFileKey;
}>;

export type StartSpecFileWatchResponse = Readonly<{
  workspacePath: string;
  specId: SpecId;
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
  specId: SpecId;
  fileKey: SpecFileKey;
  changeKind: SpecFileWatchChangeKind;
  path: string;
}>;

export type SpecFileWatchErrorEvent = Readonly<{
  workspacePath: string;
  specId: SpecId;
  fileKey: SpecFileKey;
  message: string;
}>;
