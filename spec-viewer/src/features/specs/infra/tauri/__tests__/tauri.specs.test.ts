import { invoke } from "@tauri-apps/api/core";
import { expect, test, vi } from "vitest";

import {
  archiveSpec,
  listSpecs,
  readSpecFile,
} from "@/features/specs/infra/tauri";
import { ArchiveSpecCommandError } from "@/features/specs/infra/tauri/archiveSpec";
import { ReadSpecFileCommandError } from "@/features/specs/infra/tauri/readSpecFile";
import { ListSpecsCommandError } from "@/features/specs/infra/tauri/listSpecs";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

const invokeMock = vi.mocked(invoke);

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
  });

  const result = await archiveSpec({
    workspacePath: "/workspace/spec-reviewer",
    specId: ".plugin-workspace/.specs/auth",
  });

  expect(result.archivePath).toBe(
    "/workspace/.plugin-workspace/.specs/.archive/auth",
  );
  expect(invokeMock).toHaveBeenCalledWith("archive_spec", {
    request: {
      workspacePath: "/workspace/spec-reviewer",
      specId: ".plugin-workspace/.specs/auth",
    },
  });
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

test("listSpecsはmissing children fieldをstructured decode errorとして拒否する", async () => {
  invokeMock.mockReset();
  invokeMock.mockResolvedValue({
    specs: [{ id: "auth", label: "auth", files: [] }],
  });

  await expect(listSpecs("/workspace/spec-reviewer")).rejects.toMatchObject({
    command: "list_specs",
    code: "invalidResponse",
    path: "$.specs[0].children",
  });
});
