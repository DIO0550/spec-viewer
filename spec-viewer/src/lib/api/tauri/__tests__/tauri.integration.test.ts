import { invoke } from "@tauri-apps/api/core";
import { expect, test, vi } from "vitest";

import {
  archiveSpec,
  listWorktrees,
  listSpecs,
  loadWorkspace,
  readSpecFile,
  validateWorkspaceDirectory,
} from "@/lib/api/tauri";
import { InvalidListWorktreesResponseError } from "@/lib/api/tauri/listWorktrees";
import { ArchiveSpecCommandError } from "@/lib/api/tauri/archiveSpec";
import { ListSpecsCommandError } from "@/lib/api/tauri/listSpecs";
import { LoadWorkspaceCommandError } from "@/lib/api/tauri/loadWorkspace";
import { ReadSpecFileCommandError } from "@/lib/api/tauri/readSpecFile";
import { ValidateWorkspaceDirectoryCommandError } from "@/lib/api/tauri/validateWorkspaceDirectory";

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

test("listSpecsはlist_specsへworkspacePathを渡す", async () => {
  invokeMock.mockReset();
  invokeMock.mockResolvedValue({
    specs: [
      {
        id: "auth",
        label: "auth",
        kind: "spec",
        sourceGroupId: "primary",
        relativeId: "auth",
        presentDocumentCount: 0,
        descendantSpecCount: 0,
        files: [],
        children: [],
      },
    ],
  });

  const result = await listSpecs("/workspace/spec-reviewer");

  expect(result.specs).toHaveLength(1);
  expect(result.specs[0]).toEqual(
    expect.objectContaining({
      kind: "spec",
      sourceGroupId: "primary",
      relativeId: "auth",
      presentDocumentCount: 0,
      descendantSpecCount: 0,
    }),
  );
  expect(invokeMock).toHaveBeenCalledWith("list_specs", {
    request: { workspacePath: "/workspace/spec-reviewer" },
  });
});

test("readSpecFileはread_spec_fileへspecIdとfileKeyを渡す", async () => {
  invokeMock.mockReset();
  invokeMock.mockResolvedValue({
    key: "tasks",
    format: "markdown",
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
  expect(result.format).toBe("markdown");
  expect(result.blocks[0]?.textHash).toBe("sha256:abc12345");
  expect(invokeMock).toHaveBeenCalledWith("read_spec_file", {
    request: {
      workspacePath: "/workspace/spec-reviewer",
      specId: "auth",
      fileKey: "tasks",
    },
  });
});

test("archiveSpecはarchive_specへworkspacePathとspecIdを渡す", async () => {
  invokeMock.mockReset();
  invokeMock.mockResolvedValue({
    archivedSpecId: ".plugin-workspace/.specs/auth",
    archivePath: "/workspace/.plugin-workspace/.specs/.archive/auth",
    sourceGroupId: ".plugin-workspace/.specs",
    destinationNodeId: ".archive/auth",
  });

  const result = await archiveSpec({
    workspacePath: "/workspace/spec-reviewer",
    specId: ".plugin-workspace/.specs/auth",
  });

  expect(result.archivePath).toBe(
    "/workspace/.plugin-workspace/.specs/.archive/auth",
  );
  expect(result.sourceGroupId).toBe(".plugin-workspace/.specs");
  expect(result.destinationNodeId).toBe(".archive/auth");
  expect(invokeMock).toHaveBeenCalledWith("archive_spec", {
    request: {
      workspacePath: "/workspace/spec-reviewer",
      specId: ".plugin-workspace/.specs/auth",
    },
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

test("ListSpecsCommandError.fromUnknownは正規化済みunknownエラーのmessageを保持する", () => {
  const normalizedError = ListSpecsCommandError.unknown(
    "spec tree could not be scanned",
    { cause: "invalid workspace" },
  );

  expect(ListSpecsCommandError.fromUnknown(normalizedError)).toEqual(
    normalizedError,
  );
});

test("ReadSpecFileCommandError.fromUnknownは正規化済みunknownエラーのmessageを保持する", () => {
  const normalizedError = ReadSpecFileCommandError.unknown(
    "spec file could not be read",
    { cause: "missing file" },
  );

  expect(ReadSpecFileCommandError.fromUnknown(normalizedError)).toEqual(
    normalizedError,
  );
});

test("ArchiveSpecCommandError.fromUnknownは正規化済みunknownエラーのmessageを保持する", () => {
  const normalizedError = ArchiveSpecCommandError.unknown(
    "spec could not be archived",
    { cause: "archive failed" },
  );

  expect(ArchiveSpecCommandError.fromUnknown(normalizedError)).toEqual(
    normalizedError,
  );
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
