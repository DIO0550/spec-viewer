import { expect, test, vi } from "vitest";

import {
  createOpenWorkspaceUseCase,
  type OpenWorkspaceCommand,
  type OpenWorkspacePorts,
} from "@/features/workspace/application/openWorkspace";
import { workspacePathFixture } from "@/features/workspace/testing/workspacePath";

const available = {
  isWorkspaceOpening: false,
  isBrowsingWorkspace: false,
} as const;

function failedLoadPorts(): OpenWorkspacePorts {
  return {
    validate: vi.fn(async () => ({ isDirectory: true })),
    load: vi.fn(async () => null),
    recentWorkspaces: {
      record: vi.fn(async () => undefined),
      remove: vi.fn(async () => undefined),
    },
  };
}

test.each([
  ["input", { type: "input", rawPath: "/path" }],
  ["browse", { type: "browse", rawPath: "/path" }],
  [
    "drop",
    {
      type: "drop",
      path: workspacePathFixture("/path"),
      availability: available,
    },
  ],
] as const)("%s load失敗はrecentを更新せずsilent outcomeを返す", async (source, command) => {
  const ports = failedLoadPorts();
  const openWorkspace = createOpenWorkspaceUseCase(ports);

  const outcome = await openWorkspace(command);

  expect(outcome).toEqual({ type: "loadFailedSilently", source });
  expect(ports.recentWorkspaces.record).not.toHaveBeenCalled();
  expect(ports.recentWorkspaces.remove).not.toHaveBeenCalled();
});

test("load port例外をvalidation failureへ誤分類しない", async () => {
  const failure = new Error("load boundary failed");
  const ports = failedLoadPorts();
  const openWorkspace = createOpenWorkspaceUseCase({
    ...ports,
    load: vi.fn(async () => {
      throw failure;
    }),
  });
  const command: OpenWorkspaceCommand = {
    type: "recent",
    path: workspacePathFixture("/recent"),
    activeWorkspaceRoot: null,
    availability: available,
  };

  await expect(openWorkspace(command)).rejects.toBe(failure);
  expect(ports.recentWorkspaces.remove).not.toHaveBeenCalled();
});
