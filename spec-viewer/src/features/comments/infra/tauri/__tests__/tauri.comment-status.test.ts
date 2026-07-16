import * as TestValues from "@/shared/testing/validatedValueObjects";
import { createCommentAnchorTestFixture } from "@/features/comments/testing/comment-anchor-test-fixture";
import { createCommentTestFixture } from "@/features/comments/testing/comment-test-fixture";
import { invoke } from "@tauri-apps/api/core";
import { expect, test, vi } from "vitest";

import type {
  Comment,
  CommentStatusRequest,
} from "@/features/comments/types/comment";
import {
  resolveComment,
  reopenComment,
  toggleCommentResolved,
} from "@/features/comments/infra/tauri";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

const invokeMock = vi.mocked(invoke);
const commentId = TestValues.commentId;

const comment = createCommentTestFixture({
  id: "cmt_1",
  anchor: createCommentAnchorTestFixture({
    fileKey: "tasks",
    blockType: "paragraph",
    blockIndex: 1,
    textHash: "sha256:a11ce001",
    textSnippet: "Clarify this task",
    charRange: {
      start: 0,
      end: 18,
    },
  }),
  body: "Clarify this task",
});
const commentDto = { ...comment, resolved: false };

const statusRequest: CommentStatusRequest = {
  workspacePath: "/workspace/spec-reviewer",
  specId: TestValues.specId("auth"),
  fileKey: "tasks",
  commentId: commentId("cmt_1"),
};

test.each([
  {
    label: "resolveComment",
    wrapper: resolveComment,
    commandName: "resolve_comment",
    status: "resolved",
    resolved: true,
  },
  {
    label: "reopenComment",
    wrapper: reopenComment,
    commandName: "reopen_comment",
    status: "open",
    resolved: false,
  },
  {
    label: "toggleCommentResolved",
    wrapper: toggleCommentResolved,
    commandName: "toggle_comment_resolved",
    status: "resolved",
    resolved: true,
  },
] satisfies readonly {
  label: string;
  wrapper: (request: CommentStatusRequest) => Promise<Comment>;
  commandName: string;
  status: Comment["status"];
  resolved: boolean;
}[])("$labelは対応するstatus更新commandへrequestを渡す", async (testCase) => {
  const nextCommentDto = {
    ...commentDto,
    status: testCase.status,
    resolved: testCase.resolved,
  };
  const expectedComment = createCommentTestFixture({
    id: comment.id,
    anchor: comment.anchor,
    body: comment.body,
    status: testCase.status,
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt,
  });
  invokeMock.mockReset();
  invokeMock.mockResolvedValue(nextCommentDto);

  const result = await testCase.wrapper(statusRequest);

  expect(result).toEqual(expectedComment);
  expect(invokeMock).toHaveBeenCalledWith(testCase.commandName, {
    request: statusRequest,
  });
});
