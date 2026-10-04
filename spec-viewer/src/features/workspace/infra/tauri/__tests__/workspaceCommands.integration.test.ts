import { invoke } from "@tauri-apps/api/core";
import { expect, test, vi } from "vitest";

import {
  listWorktrees,
  InvalidListWorktreesResponseError,
} from "../listWorktrees";
import { loadWorkspace, LoadWorkspaceCommandError } from "../loadWorkspace";
import {
  validateWorkspaceDirectory,
  ValidateWorkspaceDirectoryCommandError,
} from "../validateWorkspaceDirectory";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

const invokeMock = vi.mocked(invoke);

test("loadWorkspaceはload_workspaceへ選択ディレクトリを渡す", async () => {
  invokeMock.mockReset();
  invokeMock.mockResolvedValue({
    root: "/workspace/spec-reviewer",
    kind: "plugin-workspace",
    files: [{ key: "tasks", label: "Tasks", fileName: "tasks.md" }],
  });

  const result = await loadWorkspace("/workspace/spec-reviewer");

  expect(result.root).toBe("/workspace/spec-reviewer");
  expect(invokeMock).toHaveBeenCalledWith("load_workspace", {
    request: { selectedDirectory: "/workspace/spec-reviewer" },
  });
});

test("loadWorkspaceは不正なworkspace DTOをunknown command errorとして拒否する", async () => {
  const rawDto = {
    root: "/workspace/spec-reviewer",
    kind: "unsupported",
    files: [],
  };
  invokeMock.mockReset();
  invokeMock.mockResolvedValue(rawDto);

  await expect(loadWorkspace("/workspace/spec-reviewer")).rejects.toEqual({
    command: "load_workspace",
    code: "unknown",
    message: "Workspace kind is not supported",
    raw: rawDto,
  });
});

test("validateWorkspaceDirectoryはvalidate_workspace_directoryへpathを渡す", async () => {
  invokeMock.mockReset();
  invokeMock.mockResolvedValue({ isDirectory: true });

  const result = await validateWorkspaceDirectory("/workspace/spec-reviewer");

  expect(result.isDirectory).toBe(true);
  expect(invokeMock).toHaveBeenCalledWith("validate_workspace_directory", {
    request: { path: "/workspace/spec-reviewer" },
  });
});

test("loadWorkspaceはinvoke失敗時にcommand固有のworkspaceエラーでrejectする", async () => {
  const rawError = {
    code: "workspaceDetection",
    message: "workspace root was not found",
  };
  invokeMock.mockReset();
  invokeMock.mockRejectedValue(rawError);

  await expect(loadWorkspace("/workspace/missing")).rejects.toEqual({
    command: "load_workspace",
    code: "workspaceDetection",
    message: "workspace root was not found",
    raw: rawError,
  });
});

test("LoadWorkspaceCommandError.fromUnknownは正規化済みunknownエラーのmessageを保持する", () => {
  const normalizedError = LoadWorkspaceCommandError.unknown(
    "workspace could not be selected",
    { cause: "dialog cancelled" },
  );

  expect(LoadWorkspaceCommandError.fromUnknown(normalizedError)).toEqual(
    normalizedError,
  );
});

test("ValidateWorkspaceDirectoryCommandError.fromUnknownは正規化済みunknownエラーのmessageを保持する", () => {
  const normalizedError = ValidateWorkspaceDirectoryCommandError.unknown(
    "workspace path could not be checked",
    { cause: "permission denied" },
  );

  expect(
    ValidateWorkspaceDirectoryCommandError.fromUnknown(normalizedError),
  ).toEqual(normalizedError);
});

test("listWorktreesはlist_worktreesへworkspacePathを渡してWorktreeへ変換する", async () => {
  invokeMock.mockReset();
  invokeMock.mockResolvedValue({
    workspaceId: "/workspace/spec-reviewer",
    worktrees: [
      {
        id: "/workspace/spec-reviewer",
        name: "feature/review",
        categoryPath: [],
      },
    ],
  });

  const result = await listWorktrees("/workspace/spec-reviewer");

  expect(result).toEqual({
    workspaceId: "/workspace/spec-reviewer",
    worktrees: [
      {
        id: "/workspace/spec-reviewer",
        name: "feature/review",
        categoryPath: [],
        specs: [],
        changedFiles: [],
      },
    ],
  });
  expect(invokeMock).toHaveBeenCalledWith("list_worktrees", {
    request: { workspacePath: "/workspace/spec-reviewer" },
  });
});
test("listWorktreesは不正なレスポンスを拒否する", async () => {
  invokeMock.mockReset();
  invokeMock.mockResolvedValue({
    workspaceId: "/workspace/spec-reviewer",
    worktrees: [
      {
        id: "/workspace/spec-reviewer",
        name: "feature/review",
        categoryPath: "invalid",
      },
    ],
  });

  await expect(
    listWorktrees("/workspace/spec-reviewer"),
  ).rejects.toBeInstanceOf(InvalidListWorktreesResponseError);
});
