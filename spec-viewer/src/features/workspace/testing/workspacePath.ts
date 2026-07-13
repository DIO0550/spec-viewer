import {
  WorkspacePath,
  type WorkspacePath as WorkspacePathValue,
} from "@/features/workspace/domain/workspacePath";

/** @returns A validated workspace path for test fixtures. */
export function workspacePathFixture(value: string): WorkspacePathValue {
  const result = WorkspacePath.parse(value);

  if (!result.ok) {
    throw new Error(`Invalid workspace path fixture: ${value}`);
  }

  return result.path;
}
