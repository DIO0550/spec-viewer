import { expect, test, vi } from "vitest";

import {
  createOpenWorkspaceUseCase,
  type OpenWorkspaceCommand,
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

function createPorts(): OpenWorkspacePorts {
  return {
    validate: vi.fn(async () => ({ isDirectory: true })),
    load: vi.fn(async (path) => ({
      type: "loaded" as const,
      workspace: workspace(path),
    })),
    recentWorkspaces: {
      record: vi.fn(async () => undefined),
      remove: vi.fn(async () => undefined),
    },
  };
}

test.each([
  ["input", { type: "input", rawPath: " /path " }, false],
  ["browse", { type: "browse", rawPath: "/path" }, false],
  [
    "drop",
    {
      type: "drop",
      path: workspacePathFixture("/path"),
      availability: available,
    },
    true,
  ],
  [
    "recent",
    {
      type: "recent",
      path: workspacePathFixture("/path"),
      activeWorkspaceRoot: workspacePathFixture("/active"),
      availability: available,
    },
    true,
  ],
  [
    "startup restore",
    {
      type: "startupRestore",
      path: workspacePathFixture("/path"),
      activeWorkspaceRoot: null,
      availability: available,
    },
    true,
  ],
] as const)("%s commandはpreserve policyをload portへ渡す", async (_label, command, preserve) => {
  const ports = createPorts();
  const openWorkspace = createOpenWorkspaceUseCase(ports);

  await openWorkspace(command);

  expect(ports.load).toHaveBeenCalledWith(workspacePathFixture("/path"), {
    preserveCurrentWorkspace: preserve,
  });
});

test.each([
  "input",
  "browse",
] as const)("%s commandはraw pathをcanonical pathへ変換する", async (source) => {
  const ports = createPorts();
  const openWorkspace = createOpenWorkspaceUseCase(ports);

  const outcome = await openWorkspace({
    type: source,
    rawPath: "file:///workspace/spec%20viewer/",
  });

  expect(outcome).toEqual({
    type: "loaded",
    source,
    path: workspacePathFixture("/workspace/spec viewer"),
  });
  expect(ports.validate).not.toHaveBeenCalled();
});

test.each([
  ["空入力", "   ", "missingPath"],
  ["不正file URL", "file://%", "invalidPath"],
] as const)("input commandは%sをport呼び出し前に拒否する", async (_label, rawPath, reason) => {
  const ports = createPorts();
  const openWorkspace = createOpenWorkspaceUseCase(ports);

  const outcome = await openWorkspace({ type: "input", rawPath });

  expect(outcome).toMatchObject({ type: "rejected", source: "input", reason });
  expect(ports.validate).not.toHaveBeenCalled();
  expect(ports.load).not.toHaveBeenCalled();
});

test.each([
  ["opening", { isWorkspaceOpening: true, isBrowsingWorkspace: false }],
  ["browsing", { isWorkspaceOpening: false, isBrowsingWorkspace: true }],
] as const)("guarded commandは%s中にportを呼ばずskippedを返す", async (_label, availability) => {
  const commands: readonly OpenWorkspaceCommand[] = [
    {
      type: "drop",
      path: workspacePathFixture("/drop"),
      availability,
    },
    {
      type: "recent",
      path: workspacePathFixture("/recent"),
      activeWorkspaceRoot: null,
      availability,
    },
    {
      type: "startupRestore",
      path: workspacePathFixture("/startup"),
      activeWorkspaceRoot: null,
      availability,
    },
  ];
  const ports = createPorts();
  const openWorkspace = createOpenWorkspaceUseCase(ports);

  const outcomes = await Promise.all(commands.map(openWorkspace));

  expect(outcomes).toEqual([
    { type: "skipped", source: "drop" },
    { type: "skipped", source: "recent" },
    { type: "skipped", source: "startupRestore" },
  ]);
  expect(ports.validate).not.toHaveBeenCalled();
  expect(ports.load).not.toHaveBeenCalled();
});
