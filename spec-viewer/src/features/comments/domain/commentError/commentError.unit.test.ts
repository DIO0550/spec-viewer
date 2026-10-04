import { expect, test } from "vitest";

import { CommentFeatureError } from "@/features/comments/domain/commentError";

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
  const commandError = {
    command: "add_comment" as const,
    raw: null,
    code: "invalidComment" as const,
    message: "comment body is required",
  };

  expect(CommentFeatureError.fromCommandError(commandError)).toEqual({
    feature: "comments",
    code: "invalidComment",
    message: "comment body is required",
    cause: commandError,
  });
});
