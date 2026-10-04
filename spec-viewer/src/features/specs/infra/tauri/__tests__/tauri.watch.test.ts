import { invoke } from "@tauri-apps/api/core";
import { expect, test, vi } from "vitest";

import {
  startSpecFileWatch,
  StartSpecFileWatchCommandError,
} from "@/features/specs/infra/tauri/startSpecFileWatch";
import {
  stopSpecFileWatch,
  StopSpecFileWatchCommandError,
} from "@/features/specs/infra/tauri/stopSpecFileWatch";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
const invokeMock = vi.mocked(invoke);

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

test("startSpecFileWatch forwards the selected scope without changing registration metadata", async () => {
  const request = {
    workspacePath: "/workspace",
    specId: "auth",
    fileKey: "impl",
  } as const;
  const response = {
    ...request,
    strategy: "native",
    watchedPaths: ["/workspace/auth/implementation-plan.md"],
    skippedPaths: [],
    debounceMs: 100,
  };
  invokeMock.mockReset();
  invokeMock.mockResolvedValue(response);

  await expect(startSpecFileWatch(request)).resolves.toBe(response);
  expect(invokeMock).toHaveBeenCalledWith("start_spec_file_watch", { request });
});

test("stopSpecFileWatch preserves the empty request payload", async () => {
  const response = { stopped: true };
  invokeMock.mockReset();
  invokeMock.mockResolvedValue(response);

  await expect(stopSpecFileWatch()).resolves.toBe(response);
  expect(invokeMock).toHaveBeenCalledWith("stop_spec_file_watch", {
    request: {},
  });
});

test("watch command rejection preserves the command, error code, message, and raw payload", async () => {
  const raw = { code: "fileWatch", message: "native watcher failed" };
  invokeMock.mockReset();
  invokeMock.mockRejectedValue(raw);

  await expect(
    startSpecFileWatch({
      workspacePath: "/workspace",
      specId: "auth",
      fileKey: "impl",
    }),
  ).rejects.toEqual({
    command: "start_spec_file_watch",
    code: "fileWatch",
    message: raw.message,
    raw,
  });
  await expect(stopSpecFileWatch()).rejects.toEqual({
    command: "stop_spec_file_watch",
    code: "fileWatch",
    message: raw.message,
    raw,
  });
});
