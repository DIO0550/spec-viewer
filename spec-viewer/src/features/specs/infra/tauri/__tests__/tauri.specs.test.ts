import { invoke } from "@tauri-apps/api/core";
import { expect, test, vi } from "vitest";
import {
  archiveSpec,
  listSpecs,
  readSpecFile,
} from "@/features/specs/infra/tauri";
import { ArchiveSpecCommandError } from "@/features/specs/infra/tauri/archiveSpec";
import { ListSpecsCommandError } from "@/features/specs/infra/tauri/listSpecs";
import { ReadSpecFileCommandError } from "@/features/specs/infra/tauri/readSpecFile";
import * as TestValues from "@/shared/testing/validatedValueObjects";

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
        kind: "spec",
        capabilities: { reviewable: false, archiveable: true },
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

test("listSpecsはbackendのnode kindとcapabilitiesをdomainへ復元する", async () => {
  invokeMock.mockReset();
  invokeMock.mockResolvedValue({
    specs: [
      {
        id: "worktrees/main/.specs",
        label: "main",
        kind: "sourceGroup",
        capabilities: { reviewable: false, archiveable: false },
        files: [],
        children: [
          {
            id: "worktrees/main/.specs/auth",
            label: "auth",
            kind: "spec",
            capabilities: { reviewable: false, archiveable: true },
            files: [],
            children: [],
          },
        ],
      },
    ],
  });

  const result = await listSpecs("/workspace/spec-reviewer");

  expect(result.specs[0]).toMatchObject({
    kind: "sourceGroup",
    capabilities: { reviewable: false, archiveable: false },
  });
  expect(result.specs[0]?.children[0]).toMatchObject({
    kind: "spec",
    capabilities: { reviewable: false, archiveable: true },
  });
});

test("listSpecsはkindが欠落したDTOをfield path付きで拒否する", async () => {
  invokeMock.mockReset();
  invokeMock.mockResolvedValue({
    specs: [
      {
        id: "worktrees/main/.specs",
        label: "main",
        files: [],
        children: [],
      },
    ],
  });

  await expect(listSpecs("/workspace/spec-reviewer")).rejects.toMatchObject({
    command: "list_specs",
    code: "invalidResponse",
    path: "$.specs[0].kind",
  });
});

test("listSpecsはcapabilitiesが欠落したDTOをfield path付きで拒否する", async () => {
  invokeMock.mockReset();
  invokeMock.mockResolvedValue({
    specs: [
      {
        id: "auth",
        label: "auth",
        kind: "spec",
        files: [],
        children: [],
      },
    ],
  });

  await expect(listSpecs("/workspace/spec-reviewer")).rejects.toMatchObject({
    command: "list_specs",
    code: "invalidResponse",
    path: "$.specs[0].capabilities",
  });
});

test("listSpecsはunsupported node kindをfield path付きで拒否する", async () => {
  invokeMock.mockReset();
  invokeMock.mockResolvedValue({
    specs: [
      {
        id: "auth",
        label: "auth",
        kind: "container",
        capabilities: { reviewable: false, archiveable: false },
        files: [],
        children: [],
      },
    ],
  });

  await expect(listSpecs("/workspace/spec-reviewer")).rejects.toMatchObject({
    command: "list_specs",
    code: "invalidResponse",
    path: "$.specs[0].kind",
  });
});

test("listSpecsはmalformed capabilityをfield path付きで拒否する", async () => {
  invokeMock.mockReset();
  invokeMock.mockResolvedValue({
    specs: [
      {
        id: "auth",
        label: "auth",
        kind: "spec",
        capabilities: { reviewable: false, archiveable: "yes" },
        files: [],
        children: [],
      },
    ],
  });

  await expect(listSpecs("/workspace/spec-reviewer")).rejects.toMatchObject({
    command: "list_specs",
    code: "invalidResponse",
    path: "$.specs[0].capabilities.archiveable",
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
    allowsScripts: false,
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
    specId: TestValues.specId("auth"),
    fileKey: "tasks",
  });

  expect(result).toMatchObject({
    kind: "markdown",
    contents: "# Tasks",
    blocks: [{ textHash: "sha256:abc12345" }],
  });
  expect(invokeMock).toHaveBeenCalledWith("read_spec_file", {
    request: {
      workspacePath: "/workspace/spec-reviewer",
      specId: TestValues.specId("auth"),
      fileKey: "tasks",
    },
  });
});

test("readSpecFileはbackendの明示script capabilityをHTML variantへ復元する", async () => {
  invokeMock.mockReset();
  invokeMock.mockResolvedValue({
    key: "requirements",
    format: "html",
    path: "/workspace/spec-reviewer/custom-preview.html",
    contents: "<script>render()</script>",
    missing: false,
    allowsScripts: true,
    blocks: [],
  });

  const result = await readSpecFile({
    workspacePath: "/workspace/spec-reviewer",
    specId: TestValues.specId("auth"),
    fileKey: "requirements",
  });

  expect(result).toEqual({
    kind: "html",
    key: "requirements",
    path: "/workspace/spec-reviewer/custom-preview.html",
    contents: "<script>render()</script>",
    allowsScripts: true,
  });
});

test("readSpecFileはmissingなのにcontentsがある不正DTOを拒否する", async () => {
  invokeMock.mockReset();
  invokeMock.mockResolvedValue({
    key: "tasks",
    format: "markdown",
    path: "/workspace/spec-reviewer/tasks.md",
    contents: "# Unexpected",
    missing: true,
    allowsScripts: false,
    blocks: [],
  });

  await expect(
    readSpecFile({
      workspacePath: "/workspace/spec-reviewer",
      specId: TestValues.specId("auth"),
      fileKey: "tasks",
    }),
  ).rejects.toMatchObject({
    command: "read_spec_file",
    code: "invalidResponse",
    path: "$.contents",
  });
});

test("readSpecFileはmissingでないのにcontentsがnullの不正DTOを拒否する", async () => {
  invokeMock.mockReset();
  invokeMock.mockResolvedValue({
    key: "tasks",
    format: "markdown",
    path: "/workspace/spec-reviewer/tasks.md",
    contents: null,
    missing: false,
    allowsScripts: false,
    blocks: [],
  });

  await expect(
    readSpecFile({
      workspacePath: "/workspace/spec-reviewer",
      specId: TestValues.specId("auth"),
      fileKey: "tasks",
    }),
  ).rejects.toMatchObject({
    command: "read_spec_file",
    code: "invalidResponse",
    path: "$.contents",
  });
});

test("archiveSpecはarchive_specへworkspacePathとspecIdを渡す", async () => {
  invokeMock.mockReset();
  invokeMock.mockResolvedValue({
    archivedSpecId: TestValues.specId(".plugin-workspace/.specs/auth"),
    archivePath: "/workspace/.plugin-workspace/.specs/.archive/auth",
  });

  const result = await archiveSpec({
    workspacePath: "/workspace/spec-reviewer",
    specId: TestValues.specId(".plugin-workspace/.specs/auth"),
  });

  expect(result.archivePath).toBe(
    "/workspace/.plugin-workspace/.specs/.archive/auth",
  );
  expect(invokeMock).toHaveBeenCalledWith("archive_spec", {
    request: {
      workspacePath: "/workspace/spec-reviewer",
      specId: TestValues.specId(".plugin-workspace/.specs/auth"),
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
    specs: [
      {
        id: "auth",
        label: "auth",
        kind: "spec",
        capabilities: { reviewable: false, archiveable: true },
        files: [],
      },
    ],
  });

  await expect(listSpecs("/workspace/spec-reviewer")).rejects.toMatchObject({
    command: "list_specs",
    code: "invalidResponse",
    path: "$.specs[0].children",
  });
});

test("listSpecsはnested specのunsafe IDを最深path付きdecode errorとして拒否する", async () => {
  invokeMock.mockReset();
  invokeMock.mockResolvedValue({
    specs: [
      {
        id: "auth",
        label: "auth",
        kind: "spec",
        capabilities: { reviewable: false, archiveable: true },
        files: [],
        children: [
          {
            id: "../escape",
            label: "escape",
            kind: "spec",
            capabilities: { reviewable: false, archiveable: true },
            files: [],
            children: [],
          },
        ],
      },
    ],
  });

  await expect(listSpecs("/workspace/spec-reviewer")).rejects.toMatchObject({
    command: "list_specs",
    code: "invalidResponse",
    path: "$.specs[0].children[0].id",
    expected: "valid SpecId",
    actual: "../escape",
  });
});
