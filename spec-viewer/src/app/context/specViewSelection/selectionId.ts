import type { SpecFileKey } from "@/features/specs/types/spec";
import {
  WorkspacePath,
  type WorkspacePath as WorkspacePathType,
} from "@/shared/domain/workspacePath";

export type SpecViewTargetScope = "file" | "spec";

export type SpecViewSelectionId = string;

export type SpecViewSelection = Readonly<{
  workspacePath: WorkspacePathType | null;
  specId: string | null;
  fileKey: SpecFileKey | null;
  targetScope: SpecViewTargetScope;
}>;

/**
 * @param selection - Current workspace and spec view selection.
 * @returns Stable id for the selected target (spec, file, or none).
 */
function createTargetId(selection: SpecViewSelection): string {
  if (selection.specId === null) {
    return "none";
  }

  if (selection.targetScope === "spec") {
    return `spec:${selection.specId}`;
  }

  if (selection.fileKey === null) {
    return "none";
  }

  return `file:${selection.specId}:${selection.fileKey}`;
}

/**
 * @param selection - Current workspace and spec view selection.
 * @returns Stable id for the currently selected spec view target.
 */
export function createSpecViewSelectionId(
  selection: SpecViewSelection,
): SpecViewSelectionId {
  const workspaceId =
    selection.workspacePath === null
      ? "none"
      : WorkspacePath.toString(selection.workspacePath);
  const targetId = createTargetId(selection);

  return `${workspaceId}:${targetId}`;
}
