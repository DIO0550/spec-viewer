import type { SpecFileKey } from "@/shared/domain/specFileKey";
import type { SpecId as SpecIdType } from "@/shared/domain/specId";
import { SpecId } from "@/shared/domain/specId";
import {
  WorkspacePath,
  type WorkspacePath as WorkspacePathType,
} from "@/shared/domain/workspacePath";

declare const selectionIdentityBrand: unique symbol;

export type SelectionIdentity = string & {
  readonly [selectionIdentityBrand]: true;
};

export type SpecViewTargetScope = "file" | "spec";

export type SpecViewSelection = Readonly<{
  workspacePath: WorkspacePathType | null;
  specId: SpecIdType | null;
  fileKey: SpecFileKey | null;
  targetScope: SpecViewTargetScope;
}>;

export type SpecViewSelectionInput = Readonly<{
  workspacePath: WorkspacePathType | null;
  specId: string | null;
  fileKey: SpecFileKey | null;
}>;

export type SpecViewFileTarget = Readonly<{
  workspacePath: WorkspacePathType;
  specId: SpecIdType;
  fileKey: SpecFileKey;
  selectionIdentity: SelectionIdentity;
}>;

export type SpecViewReviewTarget =
  | Readonly<{
      scope: "file";
      workspacePath: WorkspacePathType;
      specId: SpecIdType;
      fileKey: SpecFileKey;
      selectionIdentity: SelectionIdentity;
    }>
  | Readonly<{
      scope: "spec";
      workspacePath: WorkspacePathType;
      specId: SpecIdType;
      selectionIdentity: SelectionIdentity;
    }>;

const emptySelection: SpecViewSelection = {
  workspacePath: null,
  specId: null,
  fileKey: null,
  targetScope: "file",
};

export const SelectionIdentity = {
  /**
   * @param selection - Selection aggregate to identify.
   * @returns Collision-safe branded identity for stale-result guards.
   */
  fromSelection(selection: SpecViewSelection): SelectionIdentity {
    const encodedParts = [
      "spec-view-selection",
      1,
      selection.workspacePath === null
        ? null
        : WorkspacePath.toString(selection.workspacePath),
      selection.specId === null ? null : SpecId.toString(selection.specId),
      selection.fileKey,
      selection.targetScope,
    ];

    return JSON.stringify(encodedParts) as SelectionIdentity;
  },

  /**
   * @param current - Current selection identity.
   * @param other - Identity captured by an operation or event.
   * @returns True when both identities represent the same aggregate state.
   */
  equals(current: SelectionIdentity, other: SelectionIdentity): boolean {
    return current === other;
  },
} as const;

export const SpecViewSelection = {
  /** @returns The empty selection aggregate. */
  empty(): SpecViewSelection {
    return emptySelection;
  },

  /**
   * @param _selection - Current aggregate before the workspace transition.
   * @param workspacePath - Workspace to select.
   * @returns Workspace selection with spec, file, and scope reset.
   */
  selectWorkspace(
    _selection: SpecViewSelection,
    workspacePath: WorkspacePathType,
  ): SpecViewSelection {
    return {
      workspacePath,
      specId: null,
      fileKey: null,
      targetScope: "file",
    };
  },

  /**
   * @param selection - Current aggregate.
   * @param specId - Spec to select.
   * @returns Spec selection with file and scope reset, or the current selection without a workspace.
   */
  selectSpec(selection: SpecViewSelection, specId: string): SpecViewSelection {
    if (selection.workspacePath === null) {
      return selection;
    }

    return {
      ...selection,
      specId: SpecId.fromString(specId),
      fileKey: null,
      targetScope: "file",
    };
  },

  /**
   * @param selection - Current aggregate.
   * @param fileKey - Spec file to select.
   * @returns File selection with scope reset, or the current incomplete selection.
   */
  selectFile(
    selection: SpecViewSelection,
    fileKey: SpecFileKey,
  ): SpecViewSelection {
    if (selection.workspacePath === null || selection.specId === null) {
      return selection;
    }

    return {
      ...selection,
      fileKey,
      targetScope: "file",
    };
  },

  /**
   * @param selection - Current aggregate.
   * @param targetScope - Review target scope to select.
   * @returns Selection with the explicit scope, or the current selection without a spec.
   */
  selectTargetScope(
    selection: SpecViewSelection,
    targetScope: SpecViewTargetScope,
  ): SpecViewSelection {
    if (selection.specId === null) {
      return selection;
    }

    return {
      ...selection,
      targetScope,
    };
  },

  /**
   * @param _selection - Current aggregate before reset.
   * @returns Empty aggregate after resetting the workspace.
   */
  resetWorkspace(_selection: SpecViewSelection): SpecViewSelection {
    return emptySelection;
  },

  /**
   * Synchronizes an external specs snapshot through the explicit aggregate transitions.
   * @param selection - Current aggregate.
   * @param input - Latest workspace/spec/file snapshot.
   * @returns Valid aggregate preserving scope only when the selected view is unchanged.
   */
  synchronize(
    selection: SpecViewSelection,
    input: SpecViewSelectionInput,
  ): SpecViewSelection {
    if (input.workspacePath === null) {
      return SpecViewSelection.resetWorkspace(selection);
    }

    const workspaceChanged = selection.workspacePath !== input.workspacePath;
    let nextSelection = workspaceChanged
      ? SpecViewSelection.selectWorkspace(selection, input.workspacePath)
      : selection;

    if (input.specId === null) {
      if (nextSelection.specId === null) {
        return nextSelection;
      }

      return SpecViewSelection.selectWorkspace(
        nextSelection,
        input.workspacePath,
      );
    }

    if (nextSelection.specId !== input.specId) {
      nextSelection = SpecViewSelection.selectSpec(nextSelection, input.specId);
    }

    if (input.fileKey === null) {
      if (nextSelection.fileKey === null) {
        return nextSelection;
      }

      return SpecViewSelection.selectSpec(nextSelection, input.specId);
    }

    if (nextSelection.fileKey !== input.fileKey) {
      return SpecViewSelection.selectFile(nextSelection, input.fileKey);
    }

    return nextSelection;
  },

  /**
   * @param selection - Current aggregate.
   * @returns Complete selected file target, or null while incomplete.
   */
  fileTarget(selection: SpecViewSelection): SpecViewFileTarget | null {
    if (
      selection.workspacePath === null ||
      selection.specId === null ||
      selection.fileKey === null
    ) {
      return null;
    }

    return {
      workspacePath: selection.workspacePath,
      specId: selection.specId,
      fileKey: selection.fileKey,
      selectionIdentity: SelectionIdentity.fromSelection(selection),
    };
  },

  /**
   * @param selection - Current aggregate.
   * @returns Complete comment target, or null while the file selection is incomplete.
   */
  commentTarget(selection: SpecViewSelection): SpecViewFileTarget | null {
    return SpecViewSelection.fileTarget(selection);
  },

  /**
   * @param selection - Current aggregate.
   * @returns Complete watch target, or null while the file selection is incomplete.
   */
  watchTarget(selection: SpecViewSelection): SpecViewFileTarget | null {
    return SpecViewSelection.fileTarget(selection);
  },

  /**
   * @param selection - Current aggregate.
   * @returns Complete file/spec review target, or null while incomplete.
   */
  reviewTarget(selection: SpecViewSelection): SpecViewReviewTarget | null {
    if (selection.workspacePath === null || selection.specId === null) {
      return null;
    }

    const selectionIdentity = SelectionIdentity.fromSelection(selection);
    if (selection.targetScope === "spec") {
      return {
        scope: "spec",
        workspacePath: selection.workspacePath,
        specId: selection.specId,
        selectionIdentity,
      };
    }

    if (selection.fileKey === null) {
      return null;
    }

    return {
      scope: "file",
      workspacePath: selection.workspacePath,
      specId: selection.specId,
      fileKey: selection.fileKey,
      selectionIdentity,
    };
  },
} as const;
