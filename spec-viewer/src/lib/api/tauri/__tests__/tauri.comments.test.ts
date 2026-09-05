import { invoke } from "@tauri-apps/api/core";
import { expect, test, vi } from "vitest";

import type { Comment } from "@/features/comments/domain/comment";
import { CommentId } from "@/features/comments/domain/commentId";
import type {
  AddCommentRequest,
  DeleteCommentRequest,
  ListCommentsRequest,
  UpdateCommentRequest,
} from "@/features/comments/types/comment";
import {
  AddCommentCommandError,
  addComment,
  commentCommands,
  deleteComment,
  listComments,
  updateComment,
} from "@/lib/api/tauri";
import { DeleteCommentCommandError } from "@/lib/api/tauri/deleteComment";
import { ExportCommentsCommandError } from "@/lib/api/tauri/exportComments";
import { GenerateLlmPromptCommandError } from "@/lib/api/tauri/generateLlmPrompt";
import { ListCommentsCommandError } from "@/lib/api/tauri/listComments";
import { ReopenCommentCommandError } from "@/lib/api/tauri/reopenComment";
import { ResolveCommentCommandError } from "@/lib/api/tauri/resolveComment";
import { UpdateCommentCommandError } from "@/lib/api/tauri/updateComment";

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
  commentId: commentId("cmt_1"),
  body: "Clarify token expiry",
};

const deleteRequest: DeleteCommentRequest = {
  workspacePath: "/workspace/spec-reviewer",
  specId: "auth",
  fileKey: "tasks",
  commentId: commentId("cmt_1"),
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

test("addCommentはinvoke失敗時にcommand固有のcommentエラーでrejectする", async () => {
  const rawError = {
    code: "invalidComment",
    message: "comment body is required",
  };
  invokeMock.mockReset();
  invokeMock.mockRejectedValue(rawError);

  await expect(addComment(addRequest)).rejects.toEqual({
    command: "add_comment",
    code: "invalidComment",
    message: "comment body is required",
    raw: rawError,
  });
});

test.each([
  ["invalidComment"],
  ["workspaceDetection"],
  ["configLoad"],
  ["commentRepository"],
  ["unexpected"],
] as const)("AddCommentCommandError.fromUnknownはknown payload %sを保持する", (code) => {
  const rawError = {
    code,
    message: `${code} failure`,
  };

  expect(AddCommentCommandError.fromUnknown(rawError)).toEqual({
    command: "add_comment",
    code,
    message: `${code} failure`,
    raw: rawError,
  });
});

test.each([
  [{ code: "other", message: "other failure" }, "Unknown add_comment failure"],
  [new Error("native failure"), "native failure"],
  ["string failure", "string failure"],
  [null, "Unknown add_comment failure"],
] as const)("AddCommentCommandError.fromUnknownはunknown payloadをunknown codeへ寄せる", (rawError, message) => {
  expect(AddCommentCommandError.fromUnknown(rawError)).toEqual({
    command: "add_comment",
    code: "unknown",
    message,
    raw: rawError,
  });
});

test("AddCommentCommandError.fromUnknownは正規化済みunknownエラーのmessageを保持する", () => {
  const normalizedError = AddCommentCommandError.unknown(
    "comment could not be saved",
    { cause: "offline" },
  );

  expect(AddCommentCommandError.fromUnknown(normalizedError)).toEqual(
    normalizedError,
  );
});

test("ListCommentsCommandError.fromUnknownは正規化済みunknownエラーのmessageを保持する", () => {
  const normalizedError = ListCommentsCommandError.unknown(
    "comments could not be loaded",
    { cause: "store unavailable" },
  );

  expect(ListCommentsCommandError.fromUnknown(normalizedError)).toEqual(
    normalizedError,
  );
});

test("UpdateCommentCommandError.fromUnknownは正規化済みunknownエラーのmessageを保持する", () => {
  const normalizedError = UpdateCommentCommandError.unknown(
    "comment could not be updated",
    { cause: "conflict" },
  );

  expect(UpdateCommentCommandError.fromUnknown(normalizedError)).toEqual(
    normalizedError,
  );
});

test("DeleteCommentCommandError.fromUnknownは正規化済みunknownエラーのmessageを保持する", () => {
  const normalizedError = DeleteCommentCommandError.unknown(
    "comment could not be deleted",
    { cause: "missing comment" },
  );

  expect(DeleteCommentCommandError.fromUnknown(normalizedError)).toEqual(
    normalizedError,
  );
});

test("ResolveCommentCommandError.fromUnknownは正規化済みunknownエラーのmessageを保持する", () => {
  const normalizedError = ResolveCommentCommandError.unknown(
    "comment could not be resolved",
    { cause: "write failed" },
  );

  expect(ResolveCommentCommandError.fromUnknown(normalizedError)).toEqual(
    normalizedError,
  );
});

test("ReopenCommentCommandError.fromUnknownは正規化済みunknownエラーのmessageを保持する", () => {
  const normalizedError = ReopenCommentCommandError.unknown(
    "comment could not be reopened",
    { cause: "write failed" },
  );

  expect(ReopenCommentCommandError.fromUnknown(normalizedError)).toEqual(
    normalizedError,
  );
});

test("ExportCommentsCommandError.fromUnknownは正規化済みunknownエラーのmessageを保持する", () => {
  const normalizedError = ExportCommentsCommandError.unknown(
    "comments could not be exported",
    { cause: "markdown failed" },
  );

  expect(ExportCommentsCommandError.fromUnknown(normalizedError)).toEqual(
    normalizedError,
  );
});

test("GenerateLlmPromptCommandError.fromUnknownは正規化済みunknownエラーのmessageを保持する", () => {
  const normalizedError = GenerateLlmPromptCommandError.unknown(
    "prompt could not be generated",
    { cause: "markdown failed" },
  );

  expect(GenerateLlmPromptCommandError.fromUnknown(normalizedError)).toEqual(
    normalizedError,
  );
});
