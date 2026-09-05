import { expect, test, vi } from "vitest";
import type { Comment } from "@/features/comments/domain/comment";
import type { CommentAnchor } from "@/features/comments/domain/commentAnchor";
import { CommentId } from "@/features/comments/domain/commentId";
import { CommentStatusFilter } from "@/features/comments/domain/commentStatusFilter";
import {
  addComment,
  deleteComment,
  listComments,
  reopenComment,
  resolveComment,
  updateComment,
} from "@/features/comments/infra/commentGateway";
import {
  CommentScope,
  type CommentScope as CommentScopeType,
} from "@/features/comments/domain/commentScope";
import { createCommentCommandTestDouble } from "@/features/comments/testing/comment-command-test-double";
import { SpecViewSelection } from "@/features/specs/domain/specViewSelection";
import { WorkspacePath } from "@/domains/workspacePath";

const commentId = CommentId.fromString;

const scopeSelection = SpecViewSelection.synchronize(
  SpecViewSelection.empty(),
  {
    workspacePath: WorkspacePath.fromString("/workspace/spec-reviewer"),
    specId: "phase-2-comments",
    fileKey: "tasks",
  },
);
const scope = CommentScope.fromSelection(scopeSelection) as CommentScopeType;

const anchor: CommentAnchor = {
  fileKey: "tasks",
  blockType: "paragraph",
  blockIndex: 0,
  textHash: "sha256:first",
  textSnippet: "Clarify this task",
  charRange: {
    start: 0,
    end: 18,
  },
};

const comment: Comment = {
  id: commentId("cmt_1"),
  anchor,
  body: "Clarify this task",
  status: "open",
  createdAt: "2026-05-05T10:00:00Z",
  updatedAt: "2026-05-05T10:00:00Z",
};

test("listCommentsはscopeとfilterとcorrelationIdをrequest DTOへ変換する", async () => {
  const double = createCommentCommandTestDouble({
    listComments: { comments: [comment] },
  });

  await expect(
    listComments(
      double.commands,
      scope,
      CommentStatusFilter.Open,
      "comments-list-test",
    ),
  ).resolves.toEqual({ comments: [comment] });

  expect(double.calls.listComments).toEqual([
    {
      workspacePath: scope.workspacePath,
      specId: scope.specId,
      fileKey: scope.fileKey,
      statusFilter: "open",
      correlationId: "comments-list-test",
    },
  ]);
});

test("listCommentsはcorrelationIdがnullならrequest DTOから省略する", async () => {
  const double = createCommentCommandTestDouble();

  await listComments(double.commands, scope, CommentStatusFilter.All, null);

  expect(double.calls.listComments).toEqual([
    {
      workspacePath: scope.workspacePath,
      specId: scope.specId,
      fileKey: scope.fileKey,
      statusFilter: "all",
    },
  ]);
});

test("addCommentはCommentCommandsへ追加request DTOを渡す", async () => {
  const double = createCommentCommandTestDouble({ addComment: comment });

  await expect(
    addComment(double.commands, scope, {
      anchor,
      body: "Clarify this task",
    }),
  ).resolves.toEqual(comment);

  expect(double.calls.addComment).toEqual([
    {
      workspacePath: scope.workspacePath,
      specId: scope.specId,
      anchor,
      body: "Clarify this task",
    },
  ]);
});

test("updateCommentはCommentCommandsへ更新request DTOを渡す", async () => {
  const updatedComment: Comment = {
    ...comment,
    body: "Updated body",
    updatedAt: "2026-05-05T10:15:00Z",
  };
  const double = createCommentCommandTestDouble({
    updateComment: updatedComment,
  });

  await expect(
    updateComment(double.commands, scope, {
      commentId: comment.id,
      body: "Updated body",
    }),
  ).resolves.toEqual(updatedComment);

  expect(double.calls.updateComment).toEqual([
    {
      workspacePath: scope.workspacePath,
      specId: scope.specId,
      fileKey: scope.fileKey,
      commentId: comment.id,
      body: "Updated body",
    },
  ]);
});

test.each([
  ["deleteComment", deleteComment, "deleteComment"],
  ["resolveComment", resolveComment, "resolveComment"],
  ["reopenComment", reopenComment, "reopenComment"],
] as const)("%sはCommentCommandsへstatus request DTOを渡す", async (_label, gatewayFunction, callKey) => {
  const double = createCommentCommandTestDouble();

  await gatewayFunction(double.commands, scope, comment.id);

  expect(double.calls[callKey]).toEqual([
    {
      workspacePath: scope.workspacePath,
      specId: scope.specId,
      fileKey: scope.fileKey,
      commentId: comment.id,
    },
  ]);
});

test("commandsのrejectはGatewayで変換せずそのままrejectする", async () => {
  const commandError = new Error("comment load failed");
  const double = createCommentCommandTestDouble();
  const commands = {
    ...double.commands,
    listComments: vi.fn().mockRejectedValue(commandError),
  };

  await expect(
    listComments(commands, scope, CommentStatusFilter.All, null),
  ).rejects.toBe(commandError);
});
