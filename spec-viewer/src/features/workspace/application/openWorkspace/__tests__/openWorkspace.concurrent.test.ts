import { expect, test, vi } from "vitest";

import {
  createOpenWorkspaceUseCase,
  type OpenWorkspacePorts,
} from "@/features/workspace/application/openWorkspace";
import type { Workspace } from "@/features/workspace/domain/workspace";
import type { WorkspacePath } from "@/features/workspace/domain/workspacePath";
import { workspacePathFixture } from "@/features/workspace/testing/workspacePath";

const available = {
  isWorkspaceOpening: false,
  isBrowsingWorkspace: false,
} as const;

function workspace(root: WorkspacePath): Workspace {
  return { root, kind: "plugin-workspace", files: [] };
}

test("recentのvalidate pending中にdrop commandも独立して実行できる", async () => {
  let resolveValidation!: (value: Readonly<{ isDirectory: boolean }>) => void;
  const firstValidation = new Promise<Readonly<{ isDirectory: boolean }>>(
    (resolve) => {
      resolveValidation = resolve;
    },
  );
  const validate = vi
    .fn<(path: WorkspacePath) => Promise<Readonly<{ isDirectory: boolean }>>>()
    .mockReturnValueOnce(firstValidation)
    .mockResolvedValueOnce({ isDirectory: true });
  const ports: OpenWorkspacePorts = {
    validate,
    load: vi.fn(async (path) => workspace(path)),
    recentWorkspaces: {
      record: vi.fn(async () => undefined),
      remove: vi.fn(async () => undefined),
    },
  };
  const openWorkspace = createOpenWorkspaceUseCase(ports);

  const recentPromise = openWorkspace({
    type: "recent",
    path: workspacePathFixture("/recent"),
    activeWorkspaceRoot: null,
    availability: available,
  });
  const dropPromise = openWorkspace({
    type: "drop",
    path: workspacePathFixture("/drop"),
    availability: available,
  });

  expect(validate).toHaveBeenCalledTimes(2);
  resolveValidation({ isDirectory: true });

  await expect(Promise.all([recentPromise, dropPromise])).resolves.toEqual([
    {
      type: "loaded",
      source: "recent",
      path: workspacePathFixture("/recent"),
    },
    {
      type: "loaded",
      source: "drop",
      path: workspacePathFixture("/drop"),
    },
  ]);
});
