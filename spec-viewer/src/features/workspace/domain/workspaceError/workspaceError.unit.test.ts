import { expect, test } from "vitest";

import { toWorkspaceError } from "@/features/workspace/domain/workspaceError";
import type { IpcCommandError } from "@/shared/types/ipc";

test.each([
  ["invalidRequest", "invalidSelection"],
  ["workspaceDetection", "detectionFailed"],
  ["configLoad", "configLoadFailed"],
  ["unknown", "unknown"],
] as const)("toWorkspaceErrorは%sをworkspace reason %sへ写す", (code, expectedReason) => {
  const cause: IpcCommandError = {
    code,
    message: "workspace failed",
    raw: { code },
  };

  expect(toWorkspaceError(cause)).toEqual({
    reason: expectedReason,
    message: "workspace failed",
    cause,
  });
});
