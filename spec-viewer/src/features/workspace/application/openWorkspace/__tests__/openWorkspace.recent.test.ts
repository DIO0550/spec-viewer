import { expect, test, vi } from "vitest";

import {
  createOpenWorkspaceUseCase,
  type OpenWorkspacePorts,
} from "@/features/workspace/application/openWorkspace";
import type { Workspace } from "@/features/workspace/domain/workspace";
import { workspacePathFixture } from "@/features/workspace/testing/workspacePath";

const available = {
  isWorkspaceOpening: false,
  isBrowsingWorkspace: false,
} as const;

function workspace(root: string): Workspace {
  return {
    root: workspacePathFixture(root),
    kind: "plugin-workspace",
    files: [],
  };
}

function createPorts(
  overrides: Partial<OpenWorkspacePorts> = {},
): OpenWorkspacePorts {
  return {
    validate: vi.fn(async () => ({ isDirectory: true })),
    load: vi.fn(async (path) => workspace(path)),
    recentWorkspaces: {
      record: vi.fn(async () => undefined),
      remove: vi.fn(async () => undefined),
    },
    ...overrides,
  };
}

test.each([
  "recent",
  "startupRestore",
] as const)("%sはmissing pathをremoveしてからrollback pathをoutcomeで返す", async (source) => {
  const order: string[] = [];
  const ports = createPorts({
    validate: vi.fn(async () => {
      order.push("validate");
      return { isDirectory: false };
    }),
    recentWorkspaces: {
      record: vi.fn(async () => undefined),
      remove: vi.fn(async () => {
        order.push("remove");
      }),
    },
  });
  const openWorkspace = createOpenWorkspaceUseCase(ports);

  const outcome = await openWorkspace({
    type: source,
    path: workspacePathFixture("/recent"),
    activeWorkspaceRoot: workspacePathFixture("/active"),
    availability: available,
  });
  order.push("rollback-ready");

  expect(order).toEqual(["validate", "remove", "rollback-ready"]);
  expect(ports.recentWorkspaces.remove).toHaveBeenCalledWith(
    workspacePathFixture("/recent"),
  );
  expect(outcome).toEqual({
    type: "recentRemoved",
    source,
    reason: "missing",
    removedPath: workspacePathFixture("/recent"),
    rollbackPath: workspacePathFixture("/active"),
  });
});

test("recent load失敗はunsupportedとしてremoveしnull rollbackを保持する", async () => {
  const ports = createPorts({ load: vi.fn(async () => null) });
  const openWorkspace = createOpenWorkspaceUseCase(ports);

  const outcome = await openWorkspace({
    type: "recent",
    path: workspacePathFixture("/recent"),
    activeWorkspaceRoot: null,
    availability: available,
  });

  expect(ports.recentWorkspaces.remove).toHaveBeenCalledWith(
    workspacePathFixture("/recent"),
  );
  expect(outcome).toEqual({
    type: "recentRemoved",
    source: "recent",
    reason: "unsupported",
    removedPath: workspacePathFixture("/recent"),
    rollbackPath: null,
  });
});

test("recent validate例外はremove後にcauseとrollback pathを返す", async () => {
  const failure = new Error("validate boom");
  const ports = createPorts({
    validate: vi.fn(async () => {
      throw failure;
    }),
  });
  const openWorkspace = createOpenWorkspaceUseCase(ports);

  const outcome = await openWorkspace({
    type: "recent",
    path: workspacePathFixture("/recent"),
    activeWorkspaceRoot: workspacePathFixture("/active"),
    availability: available,
  });

  expect(ports.recentWorkspaces.remove).toHaveBeenCalledWith(
    workspacePathFixture("/recent"),
  );
  expect(outcome).toEqual({
    type: "recentRemoved",
    source: "recent",
    reason: "validationFailed",
    cause: failure,
    removedPath: workspacePathFixture("/recent"),
    rollbackPath: workspacePathFixture("/active"),
  });
});
