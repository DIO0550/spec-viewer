import { expect, test } from "vitest";
import { isSpecFileWatchEventForSelection } from "@/features/specs/hooks/useSpecFileWatcher";
import type { SpecFileWatchChangedEvent } from "@/features/specs/types/watch";
import { SpecViewSelection } from "@/shared/domain/specViewSelection";
import { WorkspacePath } from "@/shared/domain/workspacePath";

const selection = SpecViewSelection.synchronize(SpecViewSelection.empty(), {
  workspacePath: WorkspacePath.fromString("/workspace/project"),
  specId: "auth",
  fileKey: "tasks",
});

test("watch eventがselection identityと一致する場合trueを返す", () => {
  const event: SpecFileWatchChangedEvent = {
    workspacePath: "/workspace/project",
    specId: "auth",
    fileKey: "tasks",
    changeKind: "markdown",
    path: "/workspace/project/.plugin-workspace/.specs/auth/tasks.md",
  };

  expect(isSpecFileWatchEventForSelection(event, selection)).toBe(true);
});

test.each([
  {
    workspacePath: "/workspace/other",
    specId: "auth",
    fileKey: "tasks",
  },
  {
    workspacePath: "/workspace/project",
    specId: "billing",
    fileKey: "tasks",
  },
  {
    workspacePath: "/workspace/project",
    specId: "auth",
    fileKey: "impl",
  },
] as const)("watch eventが異なるselection identityの場合falseを返す", (partialEvent) => {
  const event: SpecFileWatchChangedEvent = {
    ...partialEvent,
    changeKind: "markdown",
    path: "/workspace/project/.plugin-workspace/.specs/auth/tasks.md",
  };

  expect(isSpecFileWatchEventForSelection(event, selection)).toBe(false);
});

test("watch eventの区切り文字を含む値を構造として比較する", () => {
  const delimiterSelection = SpecViewSelection.synchronize(
    SpecViewSelection.empty(),
    {
      workspacePath: WorkspacePath.fromString("/workspace/project:a"),
      specId: "b",
      fileKey: "tasks",
    },
  );
  const event: SpecFileWatchChangedEvent = {
    workspacePath: "/workspace/project",
    specId: "a:b",
    fileKey: "tasks",
    changeKind: "markdown",
    path: "/workspace/project/.plugin-workspace/.specs/a:b/tasks.md",
  };

  expect(isSpecFileWatchEventForSelection(event, delimiterSelection)).toBe(
    false,
  );
});
