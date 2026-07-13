import { expect, test } from "vitest";

import {
  selectActiveWorkspaceRoot,
  selectIsWorkspaceOpening,
  selectRequestedWorkspacePath,
  selectWorkspace,
  selectWorkspaceError,
  type WorkspaceState,
} from "@/features/workspace/context";
import type { Workspace } from "@/features/workspace/types/workspace";
import { workspacePathFixture } from "@/features/workspace/testing/workspacePath";

const workspace: Workspace = {
  root: workspacePathFixture("/workspace/spec-reviewer"),
  kind: "plugin-workspace",
  files: [],
};

const failedState: WorkspaceState = {
  status: "failed",
  requestedPath: workspacePathFixture("/workspace/missing"),
  error: {
    reason: "detectionFailed",
    message: "not a workspace",
    cause: {
      code: "workspaceDetection",
      message: "not a workspace",
      raw: "not a workspace",
    },
  },
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
    requestedPath: workspacePathFixture("/workspace/next"),
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
