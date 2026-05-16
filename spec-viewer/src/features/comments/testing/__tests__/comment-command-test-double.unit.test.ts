import { expect, test } from "vitest";

import type {
  DeleteCommentRequest,
  ListCommentsRequest,
} from "@/features/comments/types/comment";
import { createCommentCommandTestDouble } from "@/features/comments/testing/comment-command-test-double";

const listRequest: ListCommentsRequest = {
  workspacePath: "/workspace/spec-reviewer",
  specId: "auth",
  fileKey: "tasks",
  statusFilter: "open",
};

const deleteRequest: DeleteCommentRequest = {
  workspacePath: "/workspace/spec-reviewer",
  specId: "auth",
  fileKey: "tasks",
  commentId: "cmt_1",
};

test("createCommentCommandTestDoubleは呼び出し履歴をtyped wrapper単位で保持する", async () => {
  const double = createCommentCommandTestDouble();

  const result = await double.commands.listComments(listRequest);
  await double.commands.deleteComment(deleteRequest);

  expect(result.comments).toHaveLength(1);
  expect(double.calls.listComments).toEqual([listRequest]);
  expect(double.calls.deleteComment).toEqual([deleteRequest]);
});
