import type { SpecFileKey } from "@/features/specs/types/spec";
import {
  WorkspacePath,
  type WorkspacePath as WorkspacePathType,
} from "@/shared/domain/workspacePath";

export type SpecViewTargetScope = "file" | "spec";

export type SpecViewIdentity = string;

export type SpecViewIdentityInput = Readonly<{
  workspacePath: WorkspacePathType | null;
  specId: string | null;
  fileKey: SpecFileKey | null;
  targetScope: SpecViewTargetScope;
}>;

function createTargetIdentity(input: SpecViewIdentityInput): string {
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

export const SpecViewIdentity = {
  /**
   * @param input - Current workspace and spec view selection.
   * @returns Stable identity for the currently displayed spec view.
   */
  create(input: SpecViewIdentityInput): SpecViewIdentity {
    const workspaceIdentity =
      input.workspacePath === null
        ? "none"
        : WorkspacePath.toString(input.workspacePath);
    const targetIdentity = createTargetIdentity(input);

    return `${workspaceIdentity}:${targetIdentity}`;
  },
} as const;
