import { listen, type Event as TauriEvent } from "@tauri-apps/api/event";
import { useEffect, useRef } from "react";
import {
  SelectionIdentity,
  type SelectionIdentity as SelectionIdentityType,
  SpecViewSelection,
  type SpecViewSelection as SpecViewSelectionType,
  type SpecViewTargetScope,
} from "@/features/specs/domain/specViewSelection";
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
import { WorkspacePath } from "@/shared/domain/workspacePath";

export type StartSpecFileWatchCommand = (
  request: StartSpecFileWatchRequest,
) => Promise<StartSpecFileWatchResponse>;

export type StopSpecFileWatchCommand = () => Promise<StopSpecFileWatchResponse>;

export type SpecFileWatchSubscriber = <Payload>(
  eventName: string,
  /** Handles a received event. @param event - The received Tauri event. */
  handler: (event: TauriEvent<Payload>) => void,
) => Promise<() => void>;

export type SpecFileWatchScope = StartSpecFileWatchRequest;

export type UseSpecFileWatcherOptions = Readonly<{
  selection: SpecViewSelectionType;
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
 * @param options - Selection aggregate, callbacks, and command overrides.
 */
export function useSpecFileWatcher(options: UseSpecFileWatcherOptions): void {
  const startWatch = options.startWatch ?? defaultStartSpecFileWatch;
  const stopWatch = options.stopWatch ?? defaultStopSpecFileWatch;
  const subscribe = options.subscribe ?? listen;
  const { fileKey, specId, targetScope, workspacePath } = options.selection;
  const activeWatchTarget = SpecViewSelection.watchTarget(options.selection);
  const activeSelectionIdentityRef = useRef<SelectionIdentityType | null>(
    activeWatchTarget?.selectionIdentity ?? null,
  );
  activeSelectionIdentityRef.current =
    activeWatchTarget?.selectionIdentity ?? null;

  useEffect(() => {
    const selectionSnapshot: SpecViewSelectionType = {
      workspacePath,
      specId,
      fileKey,
      targetScope,
    };
    const scope = createSpecFileWatchScope(selectionSnapshot);
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
            if (
              !isActive ||
              !isSpecFileWatchEventForSelectionIdentity(
                event.payload,
                targetScope,
                activeSelectionIdentityRef.current,
              )
            ) {
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
            if (
              !isActive ||
              !isSpecFileWatchEventForSelectionIdentity(
                event.payload,
                targetScope,
                activeSelectionIdentityRef.current,
              )
            ) {
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
    options.onConfigChange,
    options.onMarkdownChange,
    options.onWatcherError,
    fileKey,
    specId,
    startWatch,
    stopWatch,
    subscribe,
    targetScope,
    workspacePath,
  ]);
}

/**
 * @param event - Watch event to validate.
 * @param selection - Current selection aggregate.
 * @returns True when the event belongs to the same branded selection identity.
 */
export function isSpecFileWatchEventForSelection(
  event: SpecFileWatchChangedEvent | SpecFileWatchErrorEvent,
  selection: SpecViewSelectionType,
): boolean {
  const watchTarget = SpecViewSelection.watchTarget(selection);
  if (watchTarget === null) {
    return false;
  }

  return isSpecFileWatchEventForSelectionIdentity(
    event,
    selection.targetScope,
    watchTarget.selectionIdentity,
  );
}

/**
 * @param event - Watch event to validate.
 * @param targetScope - Scope captured by the listener generation.
 * @param currentSelectionIdentity - Latest identity observed during render.
 * @returns True when the listener is still aligned with the latest selection.
 */
function isSpecFileWatchEventForSelectionIdentity(
  event: SpecFileWatchChangedEvent | SpecFileWatchErrorEvent,
  targetScope: SpecViewTargetScope,
  currentSelectionIdentity: SelectionIdentityType | null,
): boolean {
  if (currentSelectionIdentity === null) {
    return false;
  }

  const eventFileSelection = SpecViewSelection.synchronize(
    SpecViewSelection.empty(),
    {
      workspacePath: WorkspacePath.fromString(event.workspacePath),
      specId: event.specId,
      fileKey: event.fileKey,
    },
  );
  const eventSelection = SpecViewSelection.selectTargetScope(
    eventFileSelection,
    targetScope,
  );

  return SelectionIdentity.equals(
    currentSelectionIdentity,
    SelectionIdentity.fromSelection(eventSelection),
  );
}

/**
 * @param selection - Current selection aggregate.
 * @returns Complete watch scope, or null while the selection is incomplete.
 */
function createSpecFileWatchScope(
  selection: SpecViewSelectionType,
): SpecFileWatchScope | null {
  const target = SpecViewSelection.watchTarget(selection);
  if (target === null) {
    return null;
  }

  return {
    workspacePath: WorkspacePath.toString(target.workspacePath),
    specId: target.specId,
    fileKey: target.fileKey,
  };
}
