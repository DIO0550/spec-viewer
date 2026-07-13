import { expect, test } from "vitest";

import { CommentId } from "@/features/comments/types/comment";
import { CreateUserReviewCommand } from "@/features/review-runs/domain/createUserReviewCommand";
import type { UserReviewTarget } from "@/features/review-runs/domain/userReviewTarget";
import { WorkspacePath } from "@/shared/domain/workspacePath";

const workspacePath = WorkspacePath.fromString("/workspace/spec-reviewer");
const target: UserReviewTarget = {
  scope: "file",
  specId: "auth-flow",
  fileKey: "tasks",
};
const firstCommentId = CommentId.fromString("cmt_first");
const secondCommentId = CommentId.fromString("cmt_second");

test("workspace・target・非空comment IDsからcreate commandを構築する", () => {
  const result = CreateUserReviewCommand.create({
    workspacePath,
    target,
    commentIds: [firstCommentId, secondCommentId],
  });

  expect(result).toEqual({
    ok: true,
    command: {
      workspacePath,
      target,
      commentIds: [firstCommentId, secondCommentId],
    },
  });
});

test.each([
  {
    name: "workspaceなし",
    input: { workspacePath: null, target, commentIds: [firstCommentId] },
    reason: "missingWorkspace",
  },
  {
    name: "targetなし",
    input: { workspacePath, target: null, commentIds: [firstCommentId] },
    reason: "missingTarget",
  },
  {
    name: "commentなし",
    input: { workspacePath, target, commentIds: [] },
    reason: "emptyCommentSelection",
  },
  {
    name: "comment ID重複",
    input: {
      workspacePath,
      target,
      commentIds: [firstCommentId, firstCommentId],
    },
    reason: "duplicateCommentId",
  },
] as const)("$nameではcreate commandを構築しない", ({ input, reason }) => {
  expect(CreateUserReviewCommand.create(input)).toMatchObject({
    ok: false,
    error: { reason },
  });
});
