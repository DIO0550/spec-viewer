import { WorkspacePath } from "@/domains/workspacePath";
import type { SpecFileKey } from "@/features/specs/domain/specFile";
import type {
  SpecFileWatchNotification,
  SpecFileWatchScope,
} from "@/features/specs/domain/specFileWatchNotification";
import { isRecord } from "@/lib/api/tauri/isRecord";
import {
  SPEC_FILE_WATCH_CHANGED_EVENT,
  SPEC_FILE_WATCH_ERROR_EVENT,
} from "@/lib/api/tauri/specFileWatchEvents";

export { SPEC_FILE_WATCH_CHANGED_EVENT, SPEC_FILE_WATCH_ERROR_EVENT };

export type RawEventSubscriber = (
  name: string,
  handler: (event: { payload: unknown }) => void,
) => Promise<() => void>;

export type SpecWatchSubscriber = (
  handler: (notification: SpecFileWatchNotification) => void,
) => Promise<() => void>;

const specFileKeys = {
  exploration: true,
  hearing: true,
  impl: true,
  tasks: true,
  "tech-reference": true,
  "test-cases": true,
  requirements: true,
  "quiz-plan": true,
  "quiz-impl": true,
} satisfies Record<SpecFileKey, true>;

/**
 * @param listenEvent - Raw event subscription at the Tauri boundary.
 * @returns Subscriber that delivers only validated domain notifications.
 */
export function createSpecWatchSubscriber(
  listenEvent: RawEventSubscriber,
): SpecWatchSubscriber {
  return async (handler) => {
    const unlistenChanged = await listenEvent(
      SPEC_FILE_WATCH_CHANGED_EVENT,
      (event) => {
        const notification = decodeChanged(event.payload);
        if (notification !== null) {
          handler(notification);
        }
      },
    );

    try {
      const unlistenError = await listenEvent(
        SPEC_FILE_WATCH_ERROR_EVENT,
        (event) => {
          const notification = decodeError(event.payload);
          if (notification !== null) {
            handler(notification);
          }
        },
      );

      return () => {
        unlistenChanged();
        unlistenError();
      };
    } catch (error) {
      unlistenChanged();
      throw error;
    }
  };
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isSpecFileKey(value: unknown): value is SpecFileKey {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(specFileKeys, value)
  );
}

function decodeScope(value: unknown): SpecFileWatchScope | null {
  if (!isRecord(value)) {
    return null;
  }

  if (
    !nonEmptyString(value.workspacePath) ||
    !nonEmptyString(value.specId) ||
    !isSpecFileKey(value.fileKey)
  ) {
    return null;
  }

  return {
    workspacePath: WorkspacePath.fromString(value.workspacePath),
    specId: value.specId,
    fileKey: value.fileKey,
  };
}

function decodeChanged(value: unknown): SpecFileWatchNotification | null {
  if (!isRecord(value)) {
    return null;
  }

  const scope = decodeScope(value);
  if (scope === null || !nonEmptyString(value.path)) {
    return null;
  }

  if (value.changeKind === "markdown") {
    return { type: "markdownChanged", scope, path: value.path };
  }

  if (value.changeKind === "config") {
    return { type: "configChanged", scope, path: value.path };
  }

  return null;
}

function decodeError(value: unknown): SpecFileWatchNotification | null {
  if (!isRecord(value)) {
    return null;
  }

  const scope = decodeScope(value);
  if (scope === null || !nonEmptyString(value.message)) {
    return null;
  }

  return { type: "watchFailed", scope, message: value.message };
}
