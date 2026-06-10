import { useCallback, useEffect, useState } from "react";
import {
  subscribeWorkspaceDragDropEvents,
  type WorkspaceDragDropEvent,
} from "@/shared/api/tauri";
import {
  createWorkspaceDropCandidate,
  extractBrowserDropPaths,
} from "@/shared/lib/workspaceDrop";

export type WorkspaceDropStatus = "idle" | "dragging";

/**
 * Subscribes to native workspace drag-and-drop events.
 * @param handler - Receives each drag-and-drop event.
 * @returns A promise resolving to an unsubscribe function.
 */
export type SubscribeWorkspaceDragDropEvents = (
  /**
   * Receives each native drag-and-drop event.
   * @param event - The emitted drag-and-drop event.
   */
  handler: (event: WorkspaceDragDropEvent) => void,
) => Promise<() => void>;

export type UseWorkspaceDropOptions = Readonly<{
  isDisabled: boolean;
  /**
   * Opens the workspace at a dropped path.
   * @param path - The dropped workspace path.
   */
  onDropWorkspacePath: (path: string) => void;
  /**
   * Reports a rejected drop with a user-facing message.
   * @param message - The reason the drop was rejected.
   */
  onInvalidDrop: (message: string) => void;
  subscribeDragDropEvents?: SubscribeWorkspaceDragDropEvents;
}>;

export type UseWorkspaceDropResult = Readonly<{
  status: WorkspaceDropStatus;
}>;

/**
 * @param options - Drop handling callbacks and an optional event subscriber.
 * @returns Workspace drag-and-drop subscription state for native and browser drops.
 */
export function useWorkspaceDrop({
  isDisabled,
  onDropWorkspacePath,
  onInvalidDrop,
  subscribeDragDropEvents = subscribeWorkspaceDragDropEvents,
}: UseWorkspaceDropOptions): UseWorkspaceDropResult {
  const [status, setStatus] = useState<WorkspaceDropStatus>("idle");

  const openDroppedPaths = useCallback(
    (paths: readonly string[]): void => {
      const candidate = createWorkspaceDropCandidate(paths);
      setStatus("idle");

      if (candidate.status === "rejected") {
        onInvalidDrop(candidate.message);
        return;
      }

      onDropWorkspacePath(candidate.path);
    },
    [onDropWorkspacePath, onInvalidDrop],
  );

  useEffect(() => {
    if (isDisabled) {
      setStatus("idle");
      return;
    }

    let isSubscribed = true;
    let unlisten: (() => void) | null = null;

    void subscribeDragDropEvents((event) => {
      if (event.type === "enter") {
        setStatus("dragging");
        return;
      }

      if (event.type === "leave") {
        setStatus("idle");
        return;
      }

      if (event.type === "drop") {
        openDroppedPaths(event.paths);
      }
    })
      .then((nextUnlisten) => {
        if (!isSubscribed) {
          nextUnlisten();
          return;
        }

        unlisten = nextUnlisten;
      })
      .catch(() => {
        setStatus("idle");
      });

    return () => {
      isSubscribed = false;

      if (unlisten !== null) {
        unlisten();
      }
    };
  }, [isDisabled, openDroppedPaths, subscribeDragDropEvents]);

  useEffect(() => {
    if (isDisabled) {
      return;
    }

    let dragDepth = 0;

    const showDropTarget = (event: DragEvent): void => {
      event.preventDefault();
      dragDepth += 1;
      setStatus("dragging");
    };

    const keepDropTarget = (event: DragEvent): void => {
      event.preventDefault();

      if (event.dataTransfer !== null) {
        event.dataTransfer.dropEffect = "copy";
      }
    };

    const hideDropTarget = (event: DragEvent): void => {
      event.preventDefault();
      dragDepth = Math.max(0, dragDepth - 1);

      if (dragDepth === 0) {
        setStatus("idle");
      }
    };

    const dropWorkspace = (event: DragEvent): void => {
      event.preventDefault();
      dragDepth = 0;
      openDroppedPaths(extractBrowserDropPaths(event.dataTransfer));
    };

    document.addEventListener("dragenter", showDropTarget);
    document.addEventListener("dragover", keepDropTarget);
    document.addEventListener("dragleave", hideDropTarget);
    document.addEventListener("drop", dropWorkspace);

    return () => {
      document.removeEventListener("dragenter", showDropTarget);
      document.removeEventListener("dragover", keepDropTarget);
      document.removeEventListener("dragleave", hideDropTarget);
      document.removeEventListener("drop", dropWorkspace);
    };
  }, [isDisabled, openDroppedPaths]);

  return { status };
}
