import { expect, test } from "vitest";

import { CommentFeatureError } from "@/features/comments/domain/commentError";
import { AddCommentCommandError } from "@/shared/api/tauri/addComment";

test.each([
  ["invalidComment", "invalidComment"],
  ["commentRepository", "commentRepository"],
  ["invalidRequest", "invalidRequest"],
  ["workspaceDetection", "unknown"],
  ["configLoad", "unknown"],
  ["unexpected", "unknown"],
] as const)("CommentFeatureError.fromCommandErrorCodeは%sを%sへ写像する", (commandCode, featureCode) => {
  expect(CommentFeatureError.fromCommandErrorCode(commandCode)).toBe(
    featureCode,
  );
});

test("CommentFeatureError.fromCommandErrorはmessageとcauseを保持する", () => {
  const commandError = AddCommentCommandError.fromUnknown({
    code: "invalidComment",
    message: "comment body is required",
  });

  expect(CommentFeatureError.fromCommandError(commandError)).toEqual({
    feature: "comments",
    code: "invalidComment",
    message: "comment body is required",
    cause: commandError,
  });
});
