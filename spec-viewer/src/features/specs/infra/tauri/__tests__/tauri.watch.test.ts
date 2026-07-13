import { invoke } from "@tauri-apps/api/core";
import { expect, test, vi } from "vitest";

import {
  startSpecFileWatch,
  stopSpecFileWatch,
} from "@/features/specs/infra/tauri";
import { StartSpecFileWatchCommandError } from "@/features/specs/infra/tauri/startSpecFileWatch";
import { StopSpecFileWatchCommandError } from "@/features/specs/infra/tauri/stopSpecFileWatch";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
const invokeMock = vi.mocked(invoke);

test("startSpecFileWatchはwatch registration successをdecodeする", async () => {
  invokeMock.mockReset();
  invokeMock.mockResolvedValue({
    workspacePath: "/workspace/spec-reviewer",
    specId: "auth",
    fileKey: "tasks",
    strategy: "direct",
    watchedPaths: ["/workspace/spec-reviewer/tasks.md"],
    skippedPaths: [],
    debounceMs: 100,
  });

  await expect(
    startSpecFileWatch({
      workspacePath: "/workspace/spec-reviewer",
      specId: "auth",
      fileKey: "tasks",
    }),
  ).resolves.toMatchObject({ fileKey: "tasks", debounceMs: 100 });
});

test("stopSpecFileWatchはmissing stopped fieldをstructured errorとして拒否する", async () => {
  invokeMock.mockReset();
  invokeMock.mockResolvedValue({});

  await expect(stopSpecFileWatch()).rejects.toMatchObject({
    command: "stop_spec_file_watch",
    code: "invalidResponse",
    path: "$.stopped",
  });
});

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
