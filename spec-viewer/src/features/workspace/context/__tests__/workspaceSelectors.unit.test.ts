import { expect, test } from "vitest";

import {
  selectActiveWorkspaceRoot,
  selectIsWorkspaceOpening,
  selectRequestedWorkspacePath,
  selectWorkspace,
  selectWorkspaceError,
  type WorkspaceState,
} from "@/features/workspace/context";
import { toWorkspaceFeatureError } from "@/features/workspace/infra/tauri/workspaceErrorMapper";
import type { Workspace } from "@/features/workspace/types/workspace";

const workspace: Workspace = {
  root: "/workspace/spec-reviewer",
  kind: "plugin-workspace",
  files: [],
};

const failedState: WorkspaceState = {
  status: "failed",
  requestedPath: "/workspace/missing",
  error: toWorkspaceFeatureError({
    code: "workspaceDetection",
    message: "not a workspace",
  }),
};

test("workspace selectorsはopenedのactive rootをworkspace.rootから導出する", () => {
  const state: WorkspaceState = {
    status: "opened",
    workspace,
    lastOpenError: null,
  };

  expect(selectWorkspace(state)).toBe(workspace);
  expect(selectActiveWorkspaceRoot(state)).toBe(workspace.root);
  expect(selectRequestedWorkspacePath(state)).toBeNull();
  expect(selectWorkspaceError(state)).toBeNull();
  expect(selectIsWorkspaceOpening(state)).toBe(false);
});

test("workspace selectorsはopeningのrequestedPathをactive rootと混ぜない", () => {
  const state: WorkspaceState = {
    status: "opening",
    requestedPath: "/workspace/next",
    currentWorkspace: workspace,
    error: null,
  };

  expect(selectWorkspace(state)).toBe(workspace);
  expect(selectActiveWorkspaceRoot(state)).toBe(workspace.root);
  expect(selectRequestedWorkspacePath(state)).toBe("/workspace/next");
  expect(selectWorkspaceError(state)).toBeNull();
  expect(selectIsWorkspaceOpening(state)).toBe(true);
});

test("workspace selectorsはfailedのrequestedPathとerrorだけを返す", () => {
  expect(selectWorkspace(failedState)).toBeNull();
  expect(selectActiveWorkspaceRoot(failedState)).toBeNull();
  expect(selectRequestedWorkspacePath(failedState)).toBe("/workspace/missing");
  expect(selectWorkspaceError(failedState)?.reason).toBe("detectionFailed");
  expect(selectIsWorkspaceOpening(failedState)).toBe(false);
});
