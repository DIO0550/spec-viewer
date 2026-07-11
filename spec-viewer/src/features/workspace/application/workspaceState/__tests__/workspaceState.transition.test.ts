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

const workspaceError: WorkspaceError = {
  reason: "detectionFailed",
  message: "not a workspace",
  cause: {
    code: "workspaceDetection",
    message: "not a workspace",
    raw: "not a workspace",
  },
};

test("WorkspaceStateはopen成功eventでopenedへ遷移する", () => {
  const requestId = createGeneration().next();
  const opening = WorkspaceState.reduce(
    WorkspaceState.initial(),
    WorkspaceState.openRequested({
      requestId,
      requestedPath: workspace.root,
      preserveCurrentWorkspace: false,
    }),
  );

  const result = WorkspaceState.reduce(
    opening,
    WorkspaceState.openSucceeded({ requestId, workspace }),
  );

  expect(result).toEqual({
    state: { status: "opened", workspace, lastOpenError: null },
    activeRequestId: null,
  });
});

test("WorkspaceStateは保持対象がないopen失敗eventでfailedへ遷移する", () => {
  const requestId = createGeneration().next();
  const opening = WorkspaceState.reduce(
    WorkspaceState.initial(),
    WorkspaceState.openRequested({
      requestId,
      requestedPath: "/workspace/missing",
      preserveCurrentWorkspace: false,
    }),
  );

  const result = WorkspaceState.reduce(
    opening,
    WorkspaceState.openFailed({ requestId, error: workspaceError }),
  );

  expect(result).toEqual({
    state: {
      status: "failed",
      requestedPath: "/workspace/missing",
      error: workspaceError,
    },
    activeRequestId: null,
  });
});

test("WorkspaceStateは指定時にopen失敗後も現在のworkspaceを保持する", () => {
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
  const opened = WorkspaceState.reduce(
    firstOpening,
    WorkspaceState.openSucceeded({ requestId: firstRequestId, workspace }),
  );
  const secondRequestId = generation.next();
  const secondOpening = WorkspaceState.reduce(
    opened,
    WorkspaceState.openRequested({
      requestId: secondRequestId,
      requestedPath: "/workspace/missing",
      preserveCurrentWorkspace: true,
    }),
  );

  const result = WorkspaceState.reduce(
    secondOpening,
    WorkspaceState.openFailed({
      requestId: secondRequestId,
      error: workspaceError,
    }),
  );

  expect(result).toEqual({
    state: { status: "opened", workspace, lastOpenError: workspaceError },
    activeRequestId: null,
  });
});

test("WorkspaceStateはreset eventでidleへ遷移する", () => {
  const requestId = createGeneration().next();
  const opening = WorkspaceState.reduce(
    WorkspaceState.initial(),
    WorkspaceState.openRequested({
      requestId,
      requestedPath: workspace.root,
      preserveCurrentWorkspace: false,
    }),
  );

  const result = WorkspaceState.reduce(opening, WorkspaceState.reset());

  expect(result).toEqual(WorkspaceState.initial());
});
