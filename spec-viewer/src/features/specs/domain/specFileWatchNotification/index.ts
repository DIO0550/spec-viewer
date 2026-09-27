import type { WorkspacePath } from "@/domains/workspacePath";
import type { SpecFileKey } from "@/features/specs/domain/specFile";
import {
  SelectionIdentity,
  SpecViewSelection,
  type SpecViewTargetScope,
  type SpecViewSelection as Selection,
} from "@/features/specs/domain/specViewSelection";

export type SpecFileWatchScope = Readonly<{
  workspacePath: WorkspacePath;
  specId: string;
  fileKey: SpecFileKey;
}>;

export type SpecFileWatchNotification =
  | Readonly<{
      type: "markdownChanged";
      scope: SpecFileWatchScope;
      path: string;
    }>
  | Readonly<{ type: "configChanged"; scope: SpecFileWatchScope; path: string }>
  | Readonly<{
      type: "watchFailed";
      scope: SpecFileWatchScope;
      message: string;
    }>;

export const SpecFileWatchNotification = {
  /**
   * @param notification - Notification to identify.
   * @param targetScope - Current view target scope.
   * @returns Identity of the notification's selection.
   */
  identityOf(
    notification: SpecFileWatchNotification,
    targetScope: SpecViewTargetScope,
  ): SelectionIdentity {
    const eventSelection = SpecViewSelection.selectTargetScope(
      SpecViewSelection.synchronize(SpecViewSelection.empty(), {
        workspacePath: notification.scope.workspacePath,
        specId: notification.scope.specId,
        fileKey: notification.scope.fileKey,
      }),
      targetScope,
    );

    return SelectionIdentity.fromSelection(eventSelection);
  },

  /**
   * @param notification - Notification to compare.
   * @param selection - Current selection.
   * @returns True when the notification belongs to the selection.
   */
  belongsToSelection(
    notification: SpecFileWatchNotification,
    selection: Selection,
  ): boolean {
    const target = SpecViewSelection.watchTarget(selection);
    if (target === null) {
      return false;
    }

    return SelectionIdentity.equals(
      target.selectionIdentity,
      SpecFileWatchNotification.identityOf(notification, selection.targetScope),
    );
  },
} as const;
