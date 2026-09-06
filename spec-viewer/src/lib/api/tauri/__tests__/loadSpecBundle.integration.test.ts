import { invoke } from "@tauri-apps/api/core";
import { expect, test, vi } from "vitest";

import {
  LOAD_SPEC_BUNDLE_COMMAND,
  LoadSpecBundleCommandError,
  loadSpecBundle,
} from "@/lib/api/tauri/loadSpecBundle";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

const invokeMock = vi.mocked(invoke);

const partialBundle = {
  specId: "081-issue-194",
  progress: "unknown",
  artifacts: [
    {
      identity: { kind: "standard", fileKey: "tasks" },
      fileKey: "tasks",
      fileName: "tasks.md",
      label: "Tasks",
      format: "markdown",
      progress: "completed",
      path: ".plugin-workspace/.specs/081-issue-194/tasks.md",
      contents: "- [x] done",
      blocks: [],
      error: null,
    },
    {
      identity: { kind: "directMarkdown", fileName: "Notes.md" },
      fileKey: null,
      fileName: "Notes.md",
      label: "Notes",
      format: "markdown",
      progress: "unknown",
      path: ".plugin-workspace/.specs/081-issue-194/Notes.md",
      contents: null,
      blocks: [],
      error: { code: "markdownRead", message: "Could not read artifact." },
    },
  ],
} as const;

test("loadSpecBundleは1回のinvokeでrequestとpartial artifact payloadを維持する", async () => {
  invokeMock.mockReset();
  invokeMock.mockResolvedValue(partialBundle);

  await expect(
    loadSpecBundle({
      workspacePath: "/workspace/spec-viewer",
      specId: "081-issue-194",
    }),
  ).resolves.toBe(partialBundle);

  expect(invokeMock).toHaveBeenCalledTimes(1);
  expect(invokeMock).toHaveBeenCalledWith(LOAD_SPEC_BUNDLE_COMMAND, {
    request: {
      workspacePath: "/workspace/spec-viewer",
      specId: "081-issue-194",
    },
  });
});

test("loadSpecBundleはcommand rejectionをbundle-level errorへ正規化する", async () => {
  const rawError = { code: "configLoad", message: "config is invalid" };
  invokeMock.mockReset();
  invokeMock.mockRejectedValue(rawError);

  await expect(
    loadSpecBundle({ workspacePath: "/workspace", specId: "spec-1" }),
  ).rejects.toEqual({
    command: LOAD_SPEC_BUNDLE_COMMAND,
    code: "configLoad",
    message: "config is invalid",
    raw: rawError,
  });
});

test("LoadSpecBundleCommandErrorは正規化済みunknownを二重wrapしない", () => {
  const normalized = LoadSpecBundleCommandError.unknown("bundle failed", {
    cause: "offline",
  });

  expect(LoadSpecBundleCommandError.fromUnknown(normalized)).toEqual(
    normalized,
  );
});
