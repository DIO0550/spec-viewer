import { invoke } from "@tauri-apps/api/core";
import { expect, test, vi } from "vitest";

import { listChangedSpecFiles } from "@/lib/api/tauri/listChangedSpecFiles";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

const invokeMock = vi.mocked(invoke);

test("listChangedSpecFilesは変更一覧commandへworkspacePathを渡してdecodeする", async () => {
  const response = {
    currentSnapshotId: "rs1_snapshot",
    resolvedBaseSha: "a".repeat(40),
    files: [
      {
        specId: "077-issue-166",
        fileKey: "tasks",
        targetPath: ".plugin-workspace/.specs/077-issue-166/tasks.md",
        oldPath: null,
        newPath: "tasks.md",
        change: "added",
      },
    ],
  };
  invokeMock.mockReset();
  invokeMock.mockResolvedValue(response);

  await expect(
    listChangedSpecFiles({ workspacePath: "/workspace" }),
  ).resolves.toEqual(response);
  expect(invokeMock).toHaveBeenCalledOnce();
  expect(invokeMock).toHaveBeenCalledWith("list_changed_spec_files", {
    request: { workspacePath: "/workspace" },
  });
});

test("listChangedSpecFilesは明示comparisonをtagged payloadで渡す", async () => {
  invokeMock.mockReset();
  invokeMock.mockResolvedValue({
    resolvedBaseSha: "b".repeat(40),
    currentSnapshotId: "rs1_snapshot",
    files: [],
  });
  const comparison = {
    kind: "localBranch",
    name: "refs/heads/previous",
  } as const;

  await listChangedSpecFiles({ workspacePath: "/workspace", comparison });

  expect(invokeMock).toHaveBeenCalledWith("list_changed_spec_files", {
    request: { workspacePath: "/workspace", comparison },
  });
});

test.each([
  "notRepository",
  "bareRepository",
  "worktreeUnavailable",
  "gitUnavailable",
  "unbornHead",
  "gitTimedOut",
] as const)("listChangedSpecFilesはBackend code=%sを保持する", async (code) => {
  const raw = { code, message: `${code} failure` };
  invokeMock.mockReset();
  invokeMock.mockRejectedValue(raw);

  await expect(
    listChangedSpecFiles({ workspacePath: "/workspace" }),
  ).rejects.toEqual({
    command: "list_changed_spec_files",
    code,
    message: `${code} failure`,
    raw,
  });
});

test.each([
  { raw: new Error("invoke failed"), message: "invoke failed" },
  { raw: "string failure", message: "string failure" },
  {
    raw: { unexpected: true },
    message: "Unknown list_changed_spec_files failure",
  },
] as const)("listChangedSpecFilesはunknown rejectを保持する: $message", async ({
  raw,
  message,
}) => {
  invokeMock.mockReset();
  invokeMock.mockRejectedValue(raw);

  await expect(
    listChangedSpecFiles({ workspacePath: "/workspace" }),
  ).rejects.toEqual({
    command: "list_changed_spec_files",
    code: "unknown",
    message,
    raw,
  });
});

test.each([
  "suffix",
  "\n",
])("listChangedSpecFilesは末尾文字付きresolved SHAをinvalidResponseにする: %j", async (trailing) => {
  const raw = {
    currentSnapshotId: "rs1_snapshot",
    resolvedBaseSha: "a".repeat(40) + trailing,
    files: [],
  };
  invokeMock.mockReset();
  invokeMock.mockResolvedValue(raw);

  await expect(
    listChangedSpecFiles({ workspacePath: "/workspace" }),
  ).rejects.toMatchObject({
    command: "list_changed_spec_files",
    code: "invalidResponse",
    message:
      "resolvedBaseSha must be a lowercase 40 or 64 character Git object ID: received an invalid value",
    raw,
  });
});

test("listChangedSpecFilesはresolved不正payloadをinvalidResponseにする", async () => {
  const raw = { currentSnapshotId: "rs1_snapshot", files: "invalid" };
  invokeMock.mockReset();
  invokeMock.mockResolvedValue(raw);

  await expect(
    listChangedSpecFiles({ workspacePath: "/workspace" }),
  ).rejects.toEqual({
    command: "list_changed_spec_files",
    code: "invalidResponse",
    message: "files must be an array: received a non-array value",
    raw,
  });
});
