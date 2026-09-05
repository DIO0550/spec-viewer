import { expect, test } from "vitest";

import { createGeneration } from "@/features/workspace/application/generation";
import { WorkspaceState } from "@/features/workspace/application/workspaceState";
import type { Workspace } from "@/features/workspace/domain/workspace";
import type { WorkspaceError } from "@/features/workspace/domain/workspaceError";

const workspace: Workspace = {
  root: "/workspace/spec-reviewer",
  kind: "plugin-workspace",
  files: [],
};

const otherWorkspace: Workspace = {
  root: "/workspace/other",
  kind: "plugin-workspace",
  files: [],
};

const workspaceError: WorkspaceError = {
  reason: "detectionFailed",
  message: "not a workspace",
  cause: {
    command: "load_workspace",
    code: "workspaceDetection",
    message: "not a workspace",
    raw: "not a workspace",
  },
};

test("WorkspaceStateはreset前のstale成功eventを無視する", () => {
  const requestId = createGeneration().next();
  const opening = WorkspaceState.reduce(
    WorkspaceState.initial(),
    WorkspaceState.openRequested({
      requestId,
      requestedPath: workspace.root,
      preserveCurrentWorkspace: false,
    }),
  );
  const reset = WorkspaceState.reduce(opening, WorkspaceState.reset());

  const result = WorkspaceState.reduce(
    reset,
    WorkspaceState.openSucceeded({ requestId, workspace }),
  );

  expect(result).toBe(reset);
});

test("WorkspaceStateは新しいrequestより古いstale成功eventを無視する", () => {
  const generation = createGeneration();
  const firstRequestId = generation.next();
  const firstOpening = WorkspaceState.reduce(
    WorkspaceState.initial(),
    WorkspaceState.openRequested({
      requestId: firstRequestId,
      requestedPath: workspace.root,
      preserveCurrentWorkspace: false,
    }),
  );
  const secondRequestId = generation.next();
  const secondOpening = WorkspaceState.reduce(
    firstOpening,
    WorkspaceState.openRequested({
      requestId: secondRequestId,
      requestedPath: otherWorkspace.root,
      preserveCurrentWorkspace: false,
    }),
  );

  const result = WorkspaceState.reduce(
    secondOpening,
    WorkspaceState.openSucceeded({
      requestId: firstRequestId,
      workspace,
    }),
  );

  expect(result).toBe(secondOpening);
});

test("WorkspaceStateは新しいrequestより古いstale失敗eventを無視する", () => {
  const generation = createGeneration();
  const firstRequestId = generation.next();
  const firstOpening = WorkspaceState.reduce(
    WorkspaceState.initial(),
    WorkspaceState.openRequested({
      requestId: firstRequestId,
      requestedPath: workspace.root,
      preserveCurrentWorkspace: false,
    }),
  );
  const secondRequestId = generation.next();
  const secondOpening = WorkspaceState.reduce(
    firstOpening,
    WorkspaceState.openRequested({
      requestId: secondRequestId,
      requestedPath: otherWorkspace.root,
      preserveCurrentWorkspace: false,
    }),
  );

  const result = WorkspaceState.reduce(
    secondOpening,
    WorkspaceState.openFailed({
      requestId: firstRequestId,
      error: workspaceError,
    }),
  );

  expect(result).toBe(secondOpening);
});
