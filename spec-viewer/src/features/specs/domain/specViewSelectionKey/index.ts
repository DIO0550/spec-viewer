import type { SpecFileKey } from "@/features/specs/types/spec";
import {
  WorkspacePath,
  type WorkspacePath as WorkspacePathType,
} from "@/shared/domain/workspacePath";

export type SpecViewTargetScope = "file" | "spec";

export type SpecViewSelectionKey = string;

export type SpecViewSelectionKeyInput = Readonly<{
  workspacePath: WorkspacePathType | null;
  specId: string | null;
  fileKey: SpecFileKey | null;
  targetScope: SpecViewTargetScope;
}>;

function createTargetKey(input: SpecViewSelectionKeyInput): string {
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

export const SpecViewSelectionKey = {
  /**
   * @param input - Current workspace and spec view selection.
   * @returns Stable key for the currently selected spec view target.
   */
  create(input: SpecViewSelectionKeyInput): SpecViewSelectionKey {
    const workspaceKey =
      input.workspacePath === null
        ? "none"
        : WorkspacePath.toString(input.workspacePath);
    const targetKey = createTargetKey(input);

    return `${workspaceKey}:${targetKey}`;
  },
} as const;
