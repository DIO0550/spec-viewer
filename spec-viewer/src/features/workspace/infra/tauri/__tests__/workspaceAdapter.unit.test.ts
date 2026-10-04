import { open } from "@tauri-apps/plugin-dialog";
import { expect, expectTypeOf, test, vi } from "vitest";

import type { WorkspaceError } from "../../../domain/workspaceError";
import { LoadWorkspaceCommandError } from "../loadWorkspace";
import { ValidateWorkspaceDirectoryCommandError } from "../validateWorkspaceDirectory";
import { tauriWorkspaceCommands } from "../workspaceCommands";

vi.mock("@tauri-apps/plugin-dialog", () => ({ open: vi.fn() }));

const openMock = vi.mocked(open);

test.each([
  "/workspace/project",
  null,
])("native workspace picker preserves its options and result: %s", async (selected) => {
  openMock.mockReset();
  openMock.mockResolvedValue(selected);

  await expect(tauriWorkspaceCommands.selectWorkspaceDirectory()).resolves.toBe(
    selected,
  );
  expect(openMock).toHaveBeenCalledWith({
    directory: true,
    multiple: false,
    title: "Open workspace",
  });
});

test("native workspace picker preserves rejection", async () => {
  const error = new Error("dialog unavailable");
  openMock.mockReset();
  openMock.mockRejectedValue(error);

  await expect(tauriWorkspaceCommands.selectWorkspaceDirectory()).rejects.toBe(
    error,
  );
});

test("workspace cause keeps the existing command-local error contract", () => {
  expectTypeOf<
    WorkspaceError["cause"]
  >().toEqualTypeOf<LoadWorkspaceCommandError>();
});

test.each([
  ["invalidRequest", "invalidSelection"],
  ["workspaceDetection", "detectionFailed"],
  ["configLoad", "configLoadFailed"],
  ["unexpected", "unknown"],
] as const)("workspace adapter maps %s without changing its cause", (code, reason) => {
  const raw = { code, message: "workspace failed" };

  expect(tauriWorkspaceCommands.toWorkspaceError(raw)).toEqual({
    reason,
    message: raw.message,
    cause: { command: "load_workspace", code, message: raw.message, raw },
  });
});

test.each([
  [new Error("load failed"), "load failed"],
  ["load failed", "load failed"],
  [{ unexpected: true }, "Unknown load_workspace failure"],
] as const)("workspace adapter preserves unknown error behavior: %#", (raw, message) => {
  expect(tauriWorkspaceCommands.toWorkspaceError(raw)).toEqual({
    reason: "unknown",
    message,
    cause: { command: "load_workspace", code: "unknown", message, raw },
  });
});

test("workspace adapter preserves an already normalized failure", () => {
  const cause = LoadWorkspaceCommandError.unknown("load failed", {
    detail: true,
  });

  expect(tauriWorkspaceCommands.toWorkspaceError(cause)).toEqual({
    reason: "unknown",
    message: cause.message,
    cause,
  });
});

test.each([
  [new Error("validation failed"), "validation failed"],
  ["validation failed", "validation failed"],
  [
    { code: "invalidRequest", message: "validation failed" },
    "validation failed",
  ],
  [
    ValidateWorkspaceDirectoryCommandError.unknown("validation failed", null),
    "validation failed",
  ],
  [{ unexpected: true }, "Unknown validate_workspace_directory failure"],
] as const)("workspace adapter preserves validation error messages: %#", (error, message) => {
  expect(tauriWorkspaceCommands.getValidationErrorMessage(error)).toBe(message);
});
