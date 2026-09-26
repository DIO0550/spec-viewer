import { expect, test } from "vitest";
import { WorkspacePath } from "@/domains/workspacePath";
import { SpecFileWatchNotification } from "@/features/specs/domain/specFileWatchNotification";
import { SpecViewSelection } from "@/features/specs/domain/specViewSelection";

const selection = SpecViewSelection.synchronize(SpecViewSelection.empty(), {
  workspacePath: WorkspacePath.fromString("/workspace/project"),
  specId: "auth",
  fileKey: "tasks",
});

test("現在の選択への監視通知を受け入れる", () => {
  const notification: SpecFileWatchNotification = {
    type: "markdownChanged",
    scope: {
      workspacePath: WorkspacePath.fromString("/workspace/project"),
      specId: "auth",
      fileKey: "tasks",
    },
    path: "/workspace/project/.plugin-workspace/.specs/auth/tasks.md",
  };

  expect(
    SpecFileWatchNotification.belongsToSelection(notification, selection),
  ).toBe(true);
});

test.each([
  { workspacePath: "/workspace/other", specId: "auth", fileKey: "tasks" },
  { workspacePath: "/workspace/project", specId: "billing", fileKey: "tasks" },
  { workspacePath: "/workspace/project", specId: "auth", fileKey: "impl" },
] as const)("異なる選択への監視通知を除外する: $workspacePath/$specId/$fileKey", (scope) => {
  const notification: SpecFileWatchNotification = {
    type: "markdownChanged",
    scope: {
      ...scope,
      workspacePath: WorkspacePath.fromString(scope.workspacePath),
    },
    path: "/workspace/project/.plugin-workspace/.specs/auth/tasks.md",
  };

  expect(
    SpecFileWatchNotification.belongsToSelection(notification, selection),
  ).toBe(false);
});

test("区切り文字を含む識別子を別の選択として扱う", () => {
  const delimiterSelection = SpecViewSelection.synchronize(
    SpecViewSelection.empty(),
    {
      workspacePath: WorkspacePath.fromString("/workspace/project:a"),
      specId: "b",
      fileKey: "tasks",
    },
  );
  const notification: SpecFileWatchNotification = {
    type: "markdownChanged",
    scope: {
      workspacePath: WorkspacePath.fromString("/workspace/project"),
      specId: "a:b",
      fileKey: "tasks",
    },
    path: "/workspace/project/.plugin-workspace/.specs/a:b/tasks.md",
  };

  expect(
    SpecFileWatchNotification.belongsToSelection(
      notification,
      delimiterSelection,
    ),
  ).toBe(false);
});
