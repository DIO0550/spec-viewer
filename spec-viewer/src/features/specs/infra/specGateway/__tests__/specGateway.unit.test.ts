import { expect, test, vi } from "vitest";

import {
  archiveSpec,
  createReadSpecFileRequest,
  listSpecs,
  readSpecFile,
} from "@/features/specs/infra/specGateway";
import type { SpecCommands } from "@/features/specs/application/ports/specCommands";
import type { SpecDocument, SpecTree } from "@/features/specs/types/spec";

const tree: SpecTree = {
  specs: [],
};

const document: SpecDocument = {
  key: "impl",
  format: "markdown",
  path: "/workspace/spec-viewer/.plugin-workspace/.specs/001/implementation-plan.md",
  contents: "# Plan",
  missing: false,
  blocks: [],
};

const archiveResponse = {
  archivedSpecId: "spec-1",
  archivePath: "/workspace/spec-viewer/.plugin-workspace/.specs/archive/spec-1",
};

test("listSpecsはcommands.listSpecsへworkspacePathを委譲する", async () => {
  const commands: SpecCommands = {
    listSpecs: vi.fn().mockResolvedValue(tree),
    readSpecFile: vi.fn().mockResolvedValue(document),
    archiveSpec: vi.fn().mockResolvedValue(archiveResponse),
  };

  await expect(listSpecs(commands, "/workspace/spec-viewer")).resolves.toBe(
    tree,
  );

  expect(commands.listSpecs).toHaveBeenCalledWith("/workspace/spec-viewer");
});

test("readSpecFileはrequest DTOを維持してcommands.readSpecFileへ委譲する", async () => {
  const request = {
    workspacePath: "/workspace/spec-viewer",
    specId: "spec-1",
    fileKey: "impl",
    correlationId: "document-read-1",
  } as const;
  const commands: SpecCommands = {
    listSpecs: vi.fn().mockResolvedValue(tree),
    readSpecFile: vi.fn().mockResolvedValue(document),
    archiveSpec: vi.fn().mockResolvedValue(archiveResponse),
  };

  await expect(readSpecFile(commands, request)).resolves.toBe(document);

  expect(commands.readSpecFile).toHaveBeenCalledWith(request);
});

test("archiveSpecはworkspacePathとspecIdを維持してcommands.archiveSpecへ委譲する", async () => {
  const request = {
    workspacePath: "/workspace/spec-viewer",
    specId: "spec-1",
  } as const;
  const commands: SpecCommands = {
    listSpecs: vi.fn().mockResolvedValue(tree),
    readSpecFile: vi.fn().mockResolvedValue(document),
    archiveSpec: vi.fn().mockResolvedValue(archiveResponse),
  };

  await expect(archiveSpec(commands, request)).resolves.toBe(archiveResponse);

  expect(commands.archiveSpec).toHaveBeenCalledWith(request);
});

test("createReadSpecFileRequestはcorrelationIdを含むread request DTOを生成する", () => {
  expect(
    createReadSpecFileRequest({
      workspacePath: "/workspace/spec-viewer",
      specId: "spec-1",
      fileKey: "tasks",
      correlationId: "document-read-1",
    }),
  ).toEqual({
    workspacePath: "/workspace/spec-viewer",
    specId: "spec-1",
    fileKey: "tasks",
    correlationId: "document-read-1",
  });
});

test("createReadSpecFileRequestはcorrelationIdが未指定ならrequest DTOから省略する", () => {
  expect(
    createReadSpecFileRequest({
      workspacePath: "/workspace/spec-viewer",
      specId: "spec-1",
      fileKey: "tasks",
    }),
  ).toEqual({
    workspacePath: "/workspace/spec-viewer",
    specId: "spec-1",
    fileKey: "tasks",
  });
});
