import { expect, test } from "vitest";

import { isSpecFileWatchEventForScope } from "./useSpecFileWatcher";
import type { SpecFileWatchChangedEvent } from "../types/watch";

const scope = {
  workspacePath: "/workspace/project",
  specId: "auth",
  fileKey: "tasks",
} as const;

test("watch event が現在の scope と一致する場合 true を返す", () => {
  const event: SpecFileWatchChangedEvent = {
    workspacePath: "/workspace/project",
    specId: "auth",
    fileKey: "tasks",
    changeKind: "markdown",
    path: "/workspace/project/.plugin-workspace/.specs/auth/tasks.md",
  };

  expect(isSpecFileWatchEventForScope(event, scope)).toBe(true);
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
] as const)("watch event が異なる scope の場合 false を返す", (partialEvent) => {
  const event: SpecFileWatchChangedEvent = {
    ...partialEvent,
    changeKind: "markdown",
    path: "/workspace/project/.plugin-workspace/.specs/auth/tasks.md",
  };

  expect(isSpecFileWatchEventForScope(event, scope)).toBe(false);
});
