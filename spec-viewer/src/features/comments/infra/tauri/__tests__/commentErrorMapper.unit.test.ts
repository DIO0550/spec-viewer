import { expect, test } from "vitest";

import {
  type CommentErrorOperation,
  toCommentFeatureError,
} from "@/features/comments/infra/tauri/commentErrorMapper";

test.each([
  ["add", "invalidComment", "commentRejected"],
  ["list", "commentRepository", "commentPersistenceFailed"],
  ["export", "invalidRequest", "requestRejected"],
] as const)("toCommentFeatureErrorは%sの%sをdomain reason %sへ写して表示契約を維持する", (operation, code, expectedReason) => {
  const rawError = { code, message: `comments: ${code}` };

  const result = toCommentFeatureError(operation, rawError);

  expect(result).toMatchObject({
    feature: "comments",
    code,
    message: rawError.message,
    domainError: { reason: expectedReason },
  });
  expect(result.cause).toMatchObject({
    code,
    message: rawError.message,
    cause: rawError,
  });
});

test.each([
  ["add", "workspaceDetection"],
  ["update", "configLoad"],
  ["delete", "unexpected"],
] as const)("toCommentFeatureErrorは%sの非domain wire code %sをunknown表示へ写してraw payloadを保持する", (operation, code) => {
  const rawError = { code, message: `comments: ${code}` };

  const result = toCommentFeatureError(operation, rawError);

  expect(result).toMatchObject({
    feature: "comments",
    code: "unknown",
    message: rawError.message,
    domainError: { reason: "unexpectedFailure" },
  });
  expect(result.cause).toMatchObject({ cause: rawError });
});

test.each([
  ["add", "add_comment"],
  ["update", "update_comment"],
  ["delete", "delete_comment"],
  ["resolve", "resolve_comment"],
  ["reopen", "reopen_comment"],
  ["toggle", "toggle_comment_resolved"],
  ["list", "list_comments"],
  ["export", "export_comments"],
  ["generatePrompt", "generate_llm_prompt"],
] as const)("toCommentFeatureErrorは%sを%s command境界で正規化する", (operation, expectedCommand) => {
  const rawError = { code: "invalidRequest", message: "invalid request" };

  const result = toCommentFeatureError(
    operation satisfies CommentErrorOperation,
    rawError,
  );

  expect(result.cause).toMatchObject({
    command: expectedCommand,
    cause: rawError,
  });
});
