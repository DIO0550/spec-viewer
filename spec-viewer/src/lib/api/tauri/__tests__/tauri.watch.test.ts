import { expect, test } from "vitest";

import { StartSpecFileWatchCommandError } from "@/lib/api/tauri/startSpecFileWatch";
import { StopSpecFileWatchCommandError } from "@/lib/api/tauri/stopSpecFileWatch";

test("StartSpecFileWatchCommandError.fromUnknownは正規化済みunknownエラーのmessageを保持する", () => {
  const normalizedError = StartSpecFileWatchCommandError.unknown(
    "watcher could not be started",
    { cause: "native watcher failed" },
  );

  expect(StartSpecFileWatchCommandError.fromUnknown(normalizedError)).toEqual(
    normalizedError,
  );
});

test("StopSpecFileWatchCommandError.fromUnknownは正規化済みunknownエラーのmessageを保持する", () => {
  const normalizedError = StopSpecFileWatchCommandError.unknown(
    "watcher could not be stopped",
    { cause: "watcher missing" },
  );

  expect(StopSpecFileWatchCommandError.fromUnknown(normalizedError)).toEqual(
    normalizedError,
  );
});
