import { expect, test } from "vitest";

import { WorkspaceError } from "@/features/workspace/domain/workspaceError";

test.each([
  ["invalidRequest", "invalidSelection"],
  ["workspaceDetection", "detectionFailed"],
  ["configLoad", "configLoadFailed"],
  ["unknown", "unknown"],
] as const)("toWorkspaceErrorは%sをworkspace reason %sへ写す", (code, expectedReason) => {
  const cause = {
    command: "load_workspace" as const,
    code,
    message: "workspace failed",
    raw: { code },
  };

  expect(WorkspaceError.fromCommand(cause)).toEqual({
    reason: expectedReason,
    message: "workspace failed",
    cause,
  });
});
