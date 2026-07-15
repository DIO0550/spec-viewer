import * as TestValues from "@/shared/testing/validatedValueObjects";
import { invoke } from "@tauri-apps/api/core";
import { expect, test, vi } from "vitest";
import {
  AddCommentCommandError,
  addComment,
  commentCommands,
  deleteComment,
  listComments,
  updateComment,
} from "@/features/comments/infra/tauri";
import { DeleteCommentCommandError } from "@/features/comments/infra/tauri/deleteComment";
import { ExportCommentsCommandError } from "@/features/comments/infra/tauri/exportComments";
import { GenerateLlmPromptCommandError } from "@/features/comments/infra/tauri/generateLlmPrompt";
import { ListCommentsCommandError } from "@/features/comments/infra/tauri/listComments";
import { ReopenCommentCommandError } from "@/features/comments/infra/tauri/reopenComment";
import { ResolveCommentCommandError } from "@/features/comments/infra/tauri/resolveComment";
import { ToggleCommentResolvedCommandError } from "@/features/comments/infra/tauri/toggleCommentResolved";
import { UpdateCommentCommandError } from "@/features/comments/infra/tauri/updateComment";
import { createCommentAnchorTestFixture } from "@/features/comments/testing/comment-anchor-test-fixture";
import { commentBody } from "@/features/comments/testing/comment-body-test-fixture";
import type {
  AddCommentRequest,
  Comment,
  DeleteCommentRequest,
  ListCommentsRequest,
  UpdateCommentRequest,
} from "@/features/comments/types/comment";

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

const listRequest: ListCommentsRequest = {
  workspacePath: "/workspace/spec-reviewer",
  specId: TestValues.specId("auth"),
  fileKey: "tasks",
  statusFilter: "open",
};

const addRequest: AddCommentRequest = {
  workspacePath: "/workspace/spec-reviewer",
  specId: TestValues.specId("auth"),
  anchor: comment.anchor,
  body: commentBody("Clarify this task"),
};

const updateRequest: UpdateCommentRequest = {
  workspacePath: "/workspace/spec-reviewer",
  specId: TestValues.specId("auth"),
  fileKey: "tasks",
  commentId: commentId("cmt_1"),
  body: commentBody("Clarify token expiry"),
};

const deleteRequest: DeleteCommentRequest = {
  workspacePath: "/workspace/spec-reviewer",
  specId: TestValues.specId("auth"),
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
    cause: rawError,
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
    cause: rawError,
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
    cause: rawError,
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

test("ToggleCommentResolvedCommandError.fromUnknownは正規化済みunknownエラーのmessageを保持する", () => {
  const normalizedError = ToggleCommentResolvedCommandError.unknown(
    "comment status could not be toggled",
    { cause: "write failed" },
  );

  expect(
    ToggleCommentResolvedCommandError.fromUnknown(normalizedError),
  ).toEqual(normalizedError);
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

test("addCommentは空のcomment IDをstructured decode errorとして拒否する", async () => {
  invokeMock.mockReset();
  invokeMock.mockResolvedValue({ ...comment, id: "" });

  await expect(addComment(addRequest)).rejects.toMatchObject({
    command: "add_comment",
    code: "invalidResponse",
    path: "$.id",
    expected: "non-empty string",
    actual: "string",
  });
});

test("listCommentsは配列内の不正日時を最深path付きdecode errorとして拒否する", async () => {
  invokeMock.mockReset();
  invokeMock.mockResolvedValue({
    comments: [{ ...comment, createdAt: "2026-02-30T10:00:00Z" }],
  });

  await expect(listComments(listRequest)).rejects.toMatchObject({
    command: "list_comments",
    code: "invalidResponse",
    path: "$.comments[0].createdAt",
    expected: "valid RFC3339 date-time",
    actual: "2026-02-30T10:00:00Z",
  });
});

test("addCommentは不正なanchor hashの実値を診断に保持する", async () => {
  invokeMock.mockReset();
  invokeMock.mockResolvedValue({
    ...comment,
    anchor: { ...comment.anchor, textHash: "   " },
  });

  await expect(addComment(addRequest)).rejects.toMatchObject({
    command: "add_comment",
    code: "invalidResponse",
    path: "$.anchor.textHash",
    expected: "non-blank text hash",
    actual: "   ",
  });
});

test("listCommentsは不正なanchor rangeの実値を診断に保持する", async () => {
  invokeMock.mockReset();
  invokeMock.mockResolvedValue({
    comments: [
      comment,
      {
        ...comment,
        id: "cmt_2",
        anchor: {
          ...comment.anchor,
          charRange: { start: 3, end: 3 },
        },
      },
    ],
  });

  await expect(listComments(listRequest)).rejects.toMatchObject({
    command: "list_comments",
    code: "invalidResponse",
    path: "$.comments[1].anchor.charRange",
    expected: "non-empty ordered character range",
    actual: '{"start":3,"end":3}',
  });
});
