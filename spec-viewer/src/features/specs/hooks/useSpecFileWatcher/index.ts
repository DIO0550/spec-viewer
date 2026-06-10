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
} from "@/shared/api/tauri";

/**
 * Starts the backend file watcher for a spec file.
 * @param request - Watch target descriptor.
 * @returns A promise resolving to the start-watch response.
 */
export type StartSpecFileWatchCommand = (
  request: StartSpecFileWatchRequest,
) => Promise<StartSpecFileWatchResponse>;

export type StopSpecFileWatchCommand = () => Promise<StopSpecFileWatchResponse>;

/**
 * Subscribes to a backend event and resolves with an unsubscribe callback.
 * @param eventName - Name of the event to subscribe to.
 * @param handler - Receives each emitted event payload.
 * @returns A promise resolving to the unsubscribe callback.
 */
export type SpecFileWatchSubscriber = <Payload>(
  eventName: string,
  /**
   * Receives each emitted event.
   * @param event - The emitted Tauri event.
   */
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
  /**
   * Called when the watched Markdown file changes.
   * @param event - The Markdown change event.
   */
  onMarkdownChange: (event: SpecFileWatchChangedEvent) => void | Promise<void>;
  /**
   * Called when the watched config file changes.
   * @param event - The config change event.
   */
  onConfigChange?: (event: SpecFileWatchChangedEvent) => void | Promise<void>;
  /**
   * Called when the watcher reports an error.
   * @param event - The watcher error event.
   */
  onWatcherError?: (event: SpecFileWatchErrorEvent) => void;
  startWatch?: StartSpecFileWatchCommand;
  stopWatch?: StopSpecFileWatchCommand;
  subscribe?: SpecFileWatchSubscriber;
}>;

/**
 * Keeps the backend file watcher aligned with the selected spec file.
 * @param options - Watch target selection and change/error callbacks.
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

/**
 * @param event - Watch change or error event to test.
 * @param scope - Selected file scope to match against.
 * @returns True when a watch event belongs to the selected file scope.
 */
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

/**
 * @param options - Current workspace path, spec ID, and file key selection.
 * @returns Complete watch scope, or null while the selection is incomplete.
 */
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
