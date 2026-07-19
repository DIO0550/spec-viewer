import { listen, type Event as TauriEvent } from "@tauri-apps/api/event";
import { useEffect } from "react";
import type { SpecFileKey } from "@/features/specs/types/spec";
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
import {
  startSpecFileWatch as defaultStartSpecFileWatch,
  stopSpecFileWatch as defaultStopSpecFileWatch,
} from "@/lib/api/tauri";

export type StartSpecFileWatchCommand = (
  request: StartSpecFileWatchRequest,
) => Promise<StartSpecFileWatchResponse>;

export type StopSpecFileWatchCommand = () => Promise<StopSpecFileWatchResponse>;

export type SpecFileWatchSubscriber = <Payload>(
  eventName: string,
  /** Handles a received event. @param event - The received Tauri event. */
  handler: (event: TauriEvent<Payload>) => void,
) => Promise<() => void>;

export type SpecFileWatchScope = Readonly<{
  workspacePath: string;
  specId: string;
  fileKey: SpecFileKey;
}>;

export type UseSpecFileWatcherOptions = Readonly<{
  workspacePath: string | null;
  specId: string | null;
  fileKey: SpecFileKey | null;
  /** Called on Markdown change. @param event - The file watch change event. */
  onMarkdownChange: (event: SpecFileWatchChangedEvent) => void | Promise<void>;
  onConfigChange?: (event: SpecFileWatchChangedEvent) => void | Promise<void>;
  onWatcherError?: (event: SpecFileWatchErrorEvent) => void;
  startWatch?: StartSpecFileWatchCommand;
  stopWatch?: StopSpecFileWatchCommand;
  subscribe?: SpecFileWatchSubscriber;
}>;

/**
 * Keeps the backend file watcher aligned with the selected spec file.
 * @param options - Selection, callbacks, and command overrides for the watcher.
 */
export function useSpecFileWatcher(options: UseSpecFileWatcherOptions): void {
  const startWatch = options.startWatch ?? defaultStartSpecFileWatch;
  const stopWatch = options.stopWatch ?? defaultStopSpecFileWatch;
  const subscribe = options.subscribe ?? listen;

  useEffect(() => {
    const scope = createSpecFileWatchScope({
      workspacePath: options.workspacePath,
      specId: options.specId,
      fileKey: options.fileKey,
    });

    if (scope === null) {
      return;
    }

    let isActive = true;
    let cleanupListeners: (() => void) | null = null;

    const startCurrentWatch = async (): Promise<void> => {
      let unlistenChanged: (() => void) | null = null;
      let unlistenError: (() => void) | null = null;
      try {
        unlistenChanged = await subscribe<SpecFileWatchChangedEvent>(
          SPEC_FILE_WATCH_CHANGED_EVENT,
          (event) => {
            if (!isSpecFileWatchEventForScope(event.payload, scope)) {
              return;
            }

            if (event.payload.changeKind === "markdown") {
              void options.onMarkdownChange(event.payload);
              return;
            }

            void options.onConfigChange?.(event.payload);
          },
        );
        unlistenError = await subscribe<SpecFileWatchErrorEvent>(
          SPEC_FILE_WATCH_ERROR_EVENT,
          (event) => {
            if (!isSpecFileWatchEventForScope(event.payload, scope)) {
              return;
            }

            options.onWatcherError?.(event.payload);
          },
        );
        cleanupListeners = () => {
          unlistenChanged?.();
          unlistenError?.();
        };

        if (!isActive) {
          cleanupListeners();
          return;
        }

        await startWatch(scope);
      } catch (error) {
        unlistenChanged?.();
        unlistenError?.();
        cleanupListeners = null;

        if (!isActive) {
          return;
        }

        options.onWatcherError?.({
          ...scope,
          message:
            error instanceof Error
              ? error.message
              : "File watcher failed to start",
        });
      }

      if (!isActive) {
        await stopWatch();
      }
    };

    void startCurrentWatch();

    return () => {
      isActive = false;
      cleanupListeners?.();
      void stopWatch();
    };
  }, [
    options.fileKey,
    options.onConfigChange,
    options.onMarkdownChange,
    options.onWatcherError,
    options.specId,
    options.workspacePath,
    startWatch,
    stopWatch,
    subscribe,
  ]);
}

/** @returns True when a watch event belongs to the selected file scope. */
export function isSpecFileWatchEventForScope(
  event: SpecFileWatchChangedEvent | SpecFileWatchErrorEvent,
  scope: SpecFileWatchScope,
): boolean {
  return (
    event.workspacePath === scope.workspacePath &&
    event.specId === scope.specId &&
    event.fileKey === scope.fileKey
  );
}

/** @returns Complete watch scope, or null while the selection is incomplete. */
function createSpecFileWatchScope(options: {
  workspacePath: string | null;
  specId: string | null;
  fileKey: SpecFileKey | null;
}): SpecFileWatchScope | null {
  if (
    options.workspacePath === null ||
    options.specId === null ||
    options.fileKey === null
  ) {
    return null;
  }

  return {
    workspacePath: options.workspacePath,
    specId: options.specId,
    fileKey: options.fileKey,
  };
}
