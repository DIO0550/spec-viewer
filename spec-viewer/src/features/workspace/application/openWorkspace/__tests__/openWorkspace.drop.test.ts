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

test("load成功はrecent repositoryへworkspaceを記録してからloadedを返す", async () => {
  const order: string[] = [];
  const loadedWorkspace = workspace("/path");
  const ports = createPorts({
    load: vi.fn(async () => {
      order.push("load");
      return loadedWorkspace;
    }),
    recentWorkspaces: {
      record: vi.fn(async () => {
        order.push("record");
      }),
      remove: vi.fn(async () => undefined),
    },
  });
  const openWorkspace = createOpenWorkspaceUseCase(ports);

  const outcome = await openWorkspace({ type: "input", rawPath: "/path" });

  expect(order).toEqual(["load", "record"]);
  expect(ports.recentWorkspaces.record).toHaveBeenCalledWith(loadedWorkspace);
  expect(outcome).toEqual({
    type: "loaded",
    source: "input",
    path: workspacePathFixture("/path"),
  });
});

test("drop commandはvalidateからloadの順に実行する", async () => {
  const order: string[] = [];
  const ports = createPorts({
    validate: vi.fn(async () => {
      order.push("validate");
      return { isDirectory: true };
    }),
    load: vi.fn(async () => {
      order.push("load");
      return workspace("/drop");
    }),
  });
  const openWorkspace = createOpenWorkspaceUseCase(ports);

  await openWorkspace({
    type: "drop",
    path: workspacePathFixture("/drop"),
    availability: available,
  });

  expect(order).toEqual(["validate", "load"]);
});

test("drop commandは非directoryをreasonで拒否しloadしない", async () => {
  const ports = createPorts({
    validate: vi.fn(async () => ({ isDirectory: false })),
  });
  const openWorkspace = createOpenWorkspaceUseCase(ports);

  const outcome = await openWorkspace({
    type: "drop",
    path: workspacePathFixture("/drop"),
    availability: available,
  });

  expect(outcome).toEqual({
    type: "rejected",
    source: "drop",
    reason: "notDirectory",
  });
  expect(ports.load).not.toHaveBeenCalled();
});

test("drop commandはvalidate例外をlocalized文言なしのreasonへ変換する", async () => {
  const failure = new Error("validate boom");
  const ports = createPorts({
    validate: vi.fn(async () => {
      throw failure;
    }),
  });
  const openWorkspace = createOpenWorkspaceUseCase(ports);

  const outcome = await openWorkspace({
    type: "drop",
    path: workspacePathFixture("/drop"),
    availability: available,
  });

  expect(outcome).toEqual({
    type: "validationFailed",
    source: "drop",
    cause: failure,
  });
});
