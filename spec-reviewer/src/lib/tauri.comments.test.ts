import { invoke } from "@tauri-apps/api/core";
import { expect, test, vi } from "vitest";

import type {
  AddCommentRequest,
  Comment,
  DeleteCommentRequest,
  ListCommentsRequest,
  UpdateCommentRequest,
} from "../types/comment";
import {
  addComment,
  commentCommands,
  deleteComment,
  listComments,
  updateComment,
} from "./tauri";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

const invokeMock = vi.mocked(invoke);

const comment: Comment = {
  id: "cmt_1",
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
  resolved: false,
  createdAt: "2026-05-05T10:00:00Z",
  updatedAt: "2026-05-05T10:00:00Z",
};

const listRequest: ListCommentsRequest = {
  workspacePath: "/workspace/spec-reviewer",
  specId: "auth",
  fileKey: "tasks",
  statusFilter: "open",
};

const addRequest: AddCommentRequest = {
  workspacePath: "/workspace/spec-reviewer",
  specId: "auth",
  anchor: comment.anchor,
  body: "Clarify this task",
};

const updateRequest: UpdateCommentRequest = {
  workspacePath: "/workspace/spec-reviewer",
  specId: "auth",
  fileKey: "tasks",
  commentId: "cmt_1",
  body: "Clarify token expiry",
};

const deleteRequest: DeleteCommentRequest = {
  workspacePath: "/workspace/spec-reviewer",
  specId: "auth",
  fileKey: "tasks",
  commentId: "cmt_1",
};

test("listCommentsはlist_commentsへフィルター付きrequestを渡す", async () => {
  invokeMock.mockReset();
  invokeMock.mockResolvedValue({ comments: [comment] });

  const result = await listComments(listRequest);

  expect(result.comments).toEqual([comment]);
  expect(invokeMock).toHaveBeenCalledWith("list_comments", {
    request: listRequest,
  });
});

test("commentCommandsはadd_commentへ追加requestを渡す", async () => {
  invokeMock.mockReset();
  invokeMock.mockResolvedValue(comment);

  const result = await commentCommands.addComment(addRequest);

  expect(result).toEqual(comment);
  expect(invokeMock).toHaveBeenCalledWith("add_comment", {
    request: addRequest,
  });
});

test("updateCommentはupdate_commentへ本文更新requestを渡す", async () => {
  invokeMock.mockReset();
  invokeMock.mockResolvedValue({
    ...comment,
    body: "Clarify token expiry",
  });

  const result = await updateComment(updateRequest);

  expect(result.body).toBe("Clarify token expiry");
  expect(invokeMock).toHaveBeenCalledWith("update_comment", {
    request: updateRequest,
  });
});

test("deleteCommentはdelete_commentへ削除requestを渡す", async () => {
  invokeMock.mockReset();
  invokeMock.mockResolvedValue({ deleted: true });

  const result = await deleteComment(deleteRequest);

  expect(result.deleted).toBe(true);
  expect(invokeMock).toHaveBeenCalledWith("delete_comment", {
    request: deleteRequest,
  });
});

test("addCommentはinvoke失敗時に正規化済みcommentエラーでrejectする", async () => {
  const rawError = {
    code: "invalidComment",
    message: "comment body is required",
  };
  invokeMock.mockReset();
  invokeMock.mockRejectedValue(rawError);

  await expect(addComment(addRequest)).rejects.toEqual({
    code: "invalidComment",
    message: "comment body is required",
    raw: rawError,
  });
});
