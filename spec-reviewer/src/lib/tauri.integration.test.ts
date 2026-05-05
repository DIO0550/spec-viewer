import { invoke } from "@tauri-apps/api/core";
import { expect, test, vi } from "vitest";

import {
  listSpecs,
  loadWorkspace,
  normalizeCommandError,
  readSpecFile,
  validateWorkspaceDirectory,
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

test("validateWorkspaceDirectoryはvalidate_workspace_directoryへpathを渡す", async () => {
  invokeMock.mockReset();
  invokeMock.mockResolvedValue({ isDirectory: true });

  const result = await validateWorkspaceDirectory("/workspace/spec-reviewer");

  expect(result.isDirectory).toBe(true);
  expect(invokeMock).toHaveBeenCalledWith("validate_workspace_directory", {
    request: { path: "/workspace/spec-reviewer" },
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
    blocks: [
      {
        blockType: "heading",
        blockIndex: 0,
        textHash: "sha256:abc12345",
        textSnippet: "Tasks",
        sourceRange: {
          startByteOffset: 0,
          endByteOffset: 7,
        },
      },
    ],
  });

  const result = await readSpecFile({
    workspacePath: "/workspace/spec-reviewer",
    specId: "auth",
    fileKey: "tasks",
  });

  expect(result.contents).toBe("# Tasks");
  expect(result.blocks[0]?.textHash).toBe("sha256:abc12345");
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

test("normalizeCommandErrorはcomment系CommandError DTOも保持する", () => {
  const rawError = {
    code: "commentRepository",
    message: "failed to update comment store",
  };

  const result = normalizeCommandError(rawError);

  expect(result).toEqual({
    code: "commentRepository",
    message: "failed to update comment store",
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
