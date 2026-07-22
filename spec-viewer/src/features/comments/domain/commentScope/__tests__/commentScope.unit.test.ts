import { expect, test } from "vitest";
import { CommentScope } from "@/features/comments/domain/commentScope";
import { CommentStatusFilter } from "@/features/comments/domain/commentStatusFilter";

const scope = {
  workspacePath: "/workspace/spec-reviewer",
  specId: "phase-2-comments",
  fileKey: "tasks",
} as const;

test.each([
  [
    scope,
    CommentStatusFilter.All,
    "/workspace/spec-reviewer:phase-2-comments:tasks:all",
  ],
  [
    scope,
    CommentStatusFilter.Resolved,
    "/workspace/spec-reviewer:phase-2-comments:tasks:resolved",
  ],
  [null, CommentStatusFilter.Open, "idle:open"],
] as const)("CommentScope.toKeyはスコープとフィルタから識別子を生成する", (input, statusFilter, expected) => {
  expect(CommentScope.toKey(input, statusFilter)).toBe(expected);
});
