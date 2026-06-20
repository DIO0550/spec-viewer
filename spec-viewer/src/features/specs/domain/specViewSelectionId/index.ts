import type { SpecFileKey } from "@/features/specs/types/spec";
import {
  WorkspacePath,
  type WorkspacePath as WorkspacePathType,
} from "@/shared/domain/workspacePath";

export type SpecViewTargetScope = "file" | "spec";

export type SpecViewSelectionId = string;

export type SpecViewSelectionIdInput = Readonly<{
  workspacePath: WorkspacePathType | null;
  specId: string | null;
  fileKey: SpecFileKey | null;
  targetScope: SpecViewTargetScope;
}>;

function createTargetId(input: SpecViewSelectionIdInput): string {
  if (input.specId === null) {
    return "none";
  }

  if (input.targetScope === "spec") {
    return `spec:${input.specId}`;
  }

  if (input.fileKey === null) {
    return "none";
  }

  return `file:${input.specId}:${input.fileKey}`;
}

export const SpecViewSelectionId = {
  /**
   * @param input - Current workspace and spec view selection.
   * @returns Stable id for the currently selected spec view target.
   */
  create(input: SpecViewSelectionIdInput): SpecViewSelectionId {
    const workspaceId =
      input.workspacePath === null
        ? "none"
        : WorkspacePath.toString(input.workspacePath);
    const targetId = createTargetId(input);

    return `${workspaceId}:${targetId}`;
  },
} as const;
