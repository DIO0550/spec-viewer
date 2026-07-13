import { expect, test } from "vitest";

import { Workspace } from "@/features/workspace/domain/workspace";

test("Workspace.createは検証済み値からaggregateを復元する", () => {
  const workspace = Workspace.create({
    root: "/workspace/project",
    kind: "plugin-workspace",
    files: [
      {
        key: "tasks",
        label: "Tasks",
        fileName: "tasks.md",
        configSource: "workspaceConfig",
      },
    ],
  });

  expect(workspace).toEqual({
    root: "/workspace/project",
    kind: "plugin-workspace",
    files: [
      {
        key: "tasks",
        label: "Tasks",
        fileName: "tasks.md",
        configSource: "workspaceConfig",
      },
    ],
  });
});

test("Workspace.createは入力のfiles配列から独立したaggregateを返す", () => {
  const files = [{ key: "tasks", label: "Tasks", fileName: "tasks.md" }];
  const workspace = Workspace.create({
    root: "/workspace/project",
    kind: "plugin-workspace",
    files,
  });

  files[0].label = "Changed";

  expect(workspace.files[0]?.label).toBe("Tasks");
});
