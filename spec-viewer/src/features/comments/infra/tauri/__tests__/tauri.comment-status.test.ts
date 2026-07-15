import * as TestValues from "@/shared/testing/validatedValueObjects";
import { createCommentAnchorTestFixture } from "@/features/comments/testing/comment-anchor-test-fixture";
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

const comment: Comment = {
  id: commentId("cmt_1"),
  anchor: createCommentAnchorTestFixture({
    fileKey: "tasks",
    blockType: "paragraph",
    blockIndex: 1,
    textHash: "sha256:anchor",
    textSnippet: "Clarify this task",
    charRange: {
      start: 0,
      end: 18,
    },
  }),
  body: "Clarify this task",
  status: "open",
  resolved: false,
  anchorResolution: null,
  createdAt: TestValues.isoDateTime("2026-05-05T10:00:00Z"),
  updatedAt: TestValues.isoDateTime("2026-05-05T10:00:00Z"),
};

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
  const nextComment = {
    ...comment,
    status: testCase.status,
    resolved: testCase.resolved,
  };
  invokeMock.mockReset();
  invokeMock.mockResolvedValue(nextComment);

  const result = await testCase.wrapper(statusRequest);

  expect(result).toEqual(nextComment);
  expect(invokeMock).toHaveBeenCalledWith(testCase.commandName, {
    request: statusRequest,
  });
});
