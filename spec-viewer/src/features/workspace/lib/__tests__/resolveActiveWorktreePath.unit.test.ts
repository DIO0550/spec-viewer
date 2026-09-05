import { expect, test } from "vitest";

import { resolveActiveWorktreePath } from "@/features/workspace/lib/resolveActiveWorktreePath";

test("Worktree選択中はそのpathをSpecsのworkspaceとして返す", () => {
  expect(
    resolveActiveWorktreePath("/repo/main", "/repo/worktrees/review"),
  ).toBe("/repo/worktrees/review");
});

test("Worktree未選択時は開いたworkspace rootへfallbackする", () => {
  expect(resolveActiveWorktreePath("/repo/main", null)).toBe("/repo/main");
  expect(resolveActiveWorktreePath(null, null)).toBeNull();
});
