import { expect, expectTypeOf, test } from "vitest";

import {
  toWorkspaceError,
  type WorkspaceError,
} from "@/features/workspace/domain/workspaceError";
import {
  LoadWorkspaceCommandError,
  type LoadWorkspaceCommandError as LoadWorkspaceCommandErrorType,
} from "@/lib/api/tauri/loadWorkspace";

test("WorkspaceErrorのcauseはload_workspace command-local errorだけを保持する", () => {
  expectTypeOf<
    WorkspaceError["cause"]
  >().toEqualTypeOf<LoadWorkspaceCommandErrorType>();
});

test.each([
  ["invalidRequest", "invalidSelection"],
  ["workspaceDetection", "detectionFailed"],
  ["configLoad", "configLoadFailed"],
  ["unknown", "unknown"],
] as const)("toWorkspaceErrorは%sをworkspace reason %sへ写す", (code, expectedReason) => {
  const cause = LoadWorkspaceCommandError.fromUnknown({
    command: "load_workspace",
    code,
    message: "workspace failed",
    raw: { code },
  });

  expect(toWorkspaceError(cause)).toEqual({
    reason: expectedReason,
    message: "workspace failed",
    cause,
  });
});
