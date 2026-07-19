import { invoke } from "@tauri-apps/api/core";
import { expect, test, vi } from "vitest";

import type { Comment } from "@/features/comments/domain/comment";
import { CommentId } from "@/features/comments/domain/commentId";
import type { CommentStatusRequest } from "@/features/comments/types/comment";

import { reopenComment, resolveComment } from "@/shared/api/tauri";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

const invokeMock = vi.mocked(invoke);
const commentId = CommentId.fromString;

const comment: Comment = {
  id: commentId("cmt_1"),
  anchor: {
    fileKey: "tasks",
    blockType: "paragraph",
    blockIndex: 1,
    textHash: "sha256:anchor",
    textSnippet: "Clarify this task",
    charRange: {
      start: 0,
      end: 18,
    },
  },
  body: "Clarify this task",
  status: "open",
  createdAt: "2026-05-05T10:00:00Z",
  updatedAt: "2026-05-05T10:00:00Z",
};

const statusRequest: CommentStatusRequest = {
  workspacePath: "/workspace/spec-reviewer",
  specId: "auth",
  fileKey: "tasks",
  commentId: commentId("cmt_1"),
};

test.each([
  {
    label: "resolveComment",
    wrapper: resolveComment,
    commandName: "resolve_comment",
    status: "resolved",
  },
  {
    label: "reopenComment",
    wrapper: reopenComment,
    commandName: "reopen_comment",
    status: "open",
  },
] satisfies readonly {
  label: string;
  wrapper: (request: CommentStatusRequest) => Promise<Comment>;
  commandName: string;
  status: Comment["status"];
}[])("$labelは対応するstatus更新commandへrequestを渡す", async (testCase) => {
  const nextComment = {
    ...comment,
    status: testCase.status,
  };
  invokeMock.mockReset();
  invokeMock.mockResolvedValue(nextComment);

  const result = await testCase.wrapper(statusRequest);

  expect(result).toEqual(nextComment);
  expect(invokeMock).toHaveBeenCalledWith(testCase.commandName, {
    request: statusRequest,
  });
});
