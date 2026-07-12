import { expect, test } from "vitest";

import { toIpcCommandError } from "@/shared/api/tauri";
import type { CommandErrorCode } from "@/shared/types/ipc";

test.each([
  "configLoad",
  "specArchive",
  "commentRepository",
  "unexpected",
  "userReviewExport",
] as const)("toIpcCommandErrorは%s codeを保持する", (code) => {
  const rawError: Readonly<{
    code: CommandErrorCode;
    message: string;
  }> = {
    code,
    message: "command failed",
  };

  expect(toIpcCommandError(rawError)).toEqual({
    code,
    message: "command failed",
    raw: rawError,
  });
});
