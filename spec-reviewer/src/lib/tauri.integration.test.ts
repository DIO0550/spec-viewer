import { invoke } from "@tauri-apps/api/core";
import { expect, test, vi } from "vitest";

import {
  listSpecs,
  loadWorkspace,
  normalizeCommandError,
  readSpecFile,
} from "./tauri";

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

test("listSpecsはlist_specsへworkspacePathを渡す", async () => {
  invokeMock.mockReset();
  invokeMock.mockResolvedValue({
    specs: [
      {
        id: "auth",
        label: "auth",
        files: [],
        children: [],
      },
    ],
  });

  const result = await listSpecs("/workspace/spec-reviewer");

  expect(result.specs).toHaveLength(1);
  expect(invokeMock).toHaveBeenCalledWith("list_specs", {
    request: { workspacePath: "/workspace/spec-reviewer" },
  });
});

test("readSpecFileはread_spec_fileへspecIdとfileKeyを渡す", async () => {
  invokeMock.mockReset();
  invokeMock.mockResolvedValue({
    key: "tasks",
    path: "/workspace/spec-reviewer/.plugin-workspace/specs/auth/tasks.md",
    contents: "# Tasks",
    missing: false,
  });

  const result = await readSpecFile({
    workspacePath: "/workspace/spec-reviewer",
    specId: "auth",
    fileKey: "tasks",
  });

  expect(result.contents).toBe("# Tasks");
  expect(invokeMock).toHaveBeenCalledWith("read_spec_file", {
    request: {
      workspacePath: "/workspace/spec-reviewer",
      specId: "auth",
      fileKey: "tasks",
    },
  });
});

test("normalizeCommandErrorはCommandError DTOを安定したエラーに変換する", () => {
  const rawError = {
    code: "configLoad",
    message: "failed to load workspace config",
  };

  const result = normalizeCommandError(rawError);

  expect(result).toEqual({
    code: "configLoad",
    message: "failed to load workspace config",
    raw: rawError,
  });
});

test("loadWorkspaceはinvoke失敗時に正規化済みエラーでrejectする", async () => {
  const rawError = {
    code: "workspaceDetection",
    message: "workspace root was not found",
  };
  invokeMock.mockReset();
  invokeMock.mockRejectedValue(rawError);

  await expect(loadWorkspace("/workspace/missing")).rejects.toEqual({
    code: "workspaceDetection",
    message: "workspace root was not found",
    raw: rawError,
  });
});
