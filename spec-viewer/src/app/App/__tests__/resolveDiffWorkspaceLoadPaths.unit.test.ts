import { expect, test } from "vitest";

import {
  resolveRepositoryDiffWorkspacePath,
  resolveSpecDiffWorkspacePath,
} from "@/app/App/resolveDiffWorkspaceLoadPaths";

test.each([
  ["specs", null],
  ["diff", "/repo"],
] as const)("%s表示でRepository Diffのworkspaceを必要時だけ返す", (mode, expected) => {
  expect(resolveRepositoryDiffWorkspacePath(mode, "/repo")).toBe(expected);
});

test.each([
  ["specs", "failed", null],
  ["diff", "idle", null],
  ["diff", "loading", null],
  ["diff", "ready", null],
  ["diff", "needsSelection", null],
  ["diff", "invalidOverride", null],
  ["diff", "failed", "/repo/worktree"],
  ["diff", "unavailable", "/repo/worktree"],
] as const)("%s表示でRepository Diffが%sならSpec Diffを必要時だけ返す", (mode, repositoryStatus, expected) => {
  expect(
    resolveSpecDiffWorkspacePath({
      mode,
      activeSpecWorkspacePath: "/repo/worktree",
      repositoryStatus,
    }),
  ).toBe(expected);
});
