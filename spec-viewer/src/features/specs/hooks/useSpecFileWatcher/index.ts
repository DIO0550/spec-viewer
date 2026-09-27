import { listen } from "@tauri-apps/api/event";
import { useEffect, useLayoutEffect, useRef } from "react";
import {
  SelectionIdentity,
  type SelectionIdentity as SelectionIdentityType,
  SpecViewSelection,
  type SpecViewSelection as SpecViewSelectionType,
} from "@/features/specs/domain/specViewSelection";
import {
  SpecFileWatchNotification,
  type SpecFileWatchNotification as WatchNotification,
} from "@/features/specs/domain/specFileWatchNotification";
import type {
  StartSpecFileWatchRequest,
  StartSpecFileWatchResponse,
  StopSpecFileWatchResponse,
} from "@/features/specs/types/watch";
import {
  createSpecWatchSubscriber,
  type SpecWatchSubscriber,
} from "@/features/specs/services/specFileWatchEvents";
import {
  startSpecFileWatch as defaultStartSpecFileWatch,
  stopSpecFileWatch as defaultStopSpecFileWatch,
} from "@/lib/api/tauri";
import { WorkspacePath } from "@/domains/workspacePath";

export type StartSpecFileWatchCommand = (
  request: StartSpecFileWatchRequest,
) => Promise<StartSpecFileWatchResponse>;

export type StopSpecFileWatchCommand = () => Promise<StopSpecFileWatchResponse>;

export type SpecFileWatchSubscriber = SpecWatchSubscriber;

export type SpecFileWatchScope = StartSpecFileWatchRequest;

export type UseSpecFileWatcherOptions = Readonly<{
  selection: SpecViewSelectionType;
  /** Called on Markdown change. @param event - The file watch change event. */
  onMarkdownChange: (
    event: Extract<WatchNotification, { type: "markdownChanged" }>,
  ) => void | Promise<void>;
  onConfigChange?: (
    event: Extract<WatchNotification, { type: "configChanged" }>,
  ) => void | Promise<void>;
  onWatcherError?: (
    event: Extract<WatchNotification, { type: "watchFailed" }>,
  ) => void;
  startWatch?: StartSpecFileWatchCommand;
  stopWatch?: StopSpecFileWatchCommand;
  subscribe?: SpecFileWatchSubscriber;
}>;

let specFileWatchLifecycleQueue: Promise<void> = Promise.resolve();
const defaultSubscribe = createSpecWatchSubscriber(listen);

/**
 * Serializes commands that mutate the backend's single global watcher.
 * @param operation - Watcher lifecycle operation to append.
 * @returns The queued operation result for generation-local error handling.
 */
function enqueueSpecFileWatchLifecycleOperation(
  operation: () => Promise<void>,
): Promise<void> {
  const queuedOperation = specFileWatchLifecycleQueue.then(operation);
  specFileWatchLifecycleQueue = queuedOperation.catch(() => undefined);
  return queuedOperation;
}

/**
 * Keeps the backend file watcher aligned with the selected spec file.
 * @param options - Selection aggregate, callbacks, and command overrides.
 */
export function useSpecFileWatcher(options: UseSpecFileWatcherOptions): void {
  const startWatch = options.startWatch ?? defaultStartSpecFileWatch;
  const stopWatch = options.stopWatch ?? defaultStopSpecFileWatch;
  const subscribe = options.subscribe ?? defaultSubscribe;
  const { fileKey, specId, targetScope, workspacePath } = options.selection;
  const activeWatchTarget = SpecViewSelection.watchTarget(options.selection);
  const activeSelectionIdentity = activeWatchTarget?.selectionIdentity ?? null;
  const activeSelectionIdentityRef = useRef<SelectionIdentityType | null>(
    activeSelectionIdentity,
  );

  useLayoutEffect(() => {
    activeSelectionIdentityRef.current = activeSelectionIdentity;
  }, [activeSelectionIdentity]);

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
      try {
        cleanupListeners = await subscribe((notification) => {
          const currentIdentity = activeSelectionIdentityRef.current;
          if (
            !isActive ||
            currentIdentity === null ||
            !SelectionIdentity.equals(
              currentIdentity,
              SpecFileWatchNotification.identityOf(notification, targetScope),
            )
          ) {
            return;
          }

          switch (notification.type) {
            case "markdownChanged":
              void options.onMarkdownChange(notification);
              break;
            case "configChanged":
              void options.onConfigChange?.(notification);
              break;
            case "watchFailed":
              options.onWatcherError?.(notification);
              break;
            default:
              notification satisfies never;
          }
        });

        if (!isActive) {
          cleanupListeners();
          return;
        }

        await enqueueSpecFileWatchLifecycleOperation(async () => {
          if (!isActive) {
            return;
          }

          await startWatch(scope);
        });
      } catch (error) {
        cleanupListeners?.();
        cleanupListeners = null;

        if (!isActive) {
          return;
        }

        options.onWatcherError?.({
          type: "watchFailed",
          scope: {
            workspacePath: WorkspacePath.fromString(scope.workspacePath),
            specId: scope.specId,
            fileKey: scope.fileKey,
          },
          message:
            error instanceof Error
              ? error.message
              : "File watcher failed to start",
        });
      }
    };

    void startCurrentWatch();

    return () => {
      isActive = false;
      cleanupListeners?.();
      void enqueueSpecFileWatchLifecycleOperation(async () => {
        await stopWatch();
      }).catch(() => undefined);
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
