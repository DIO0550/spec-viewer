import { expect, test, vi } from "vitest";

import type { SpecCommands } from "@/features/specs/application/ports/specCommands";
import { createSpecGateway } from "@/features/specs/infra/specGateway";
import { toSpecFeatureError } from "@/features/specs/infra/tauri/specErrorMapper";
import type { SpecDocument, SpecTree } from "@/features/specs/types/spec";
import * as TestValues from "@/shared/testing/validatedValueObjects";
import { WorkspacePath } from "@/shared/domain/workspacePath";

const workspacePath = WorkspacePath.fromString("/workspace/spec-viewer");
const specId = TestValues.specId("spec-1");
const tree: SpecTree = { specs: [] };
const document: SpecDocument = {
  kind: "markdown",
  key: "impl",
  path: "/workspace/spec-viewer/.plugin-workspace/.specs/001/implementation-plan.md",
  contents: "# Plan",
  blocks: [],
};
const archiveResponse = {
  archivedSpecId: specId,
  archivePath: "/workspace/spec-viewer/.plugin-workspace/.specs/archive/spec-1",
};

function createCommands(): SpecCommands {
  return {
    listSpecs: vi.fn().mockResolvedValue(tree),
    readSpecFile: vi.fn().mockResolvedValue(document),
    archiveSpec: vi.fn().mockResolvedValue(archiveResponse),
  };
}

test("gatewayはvalidated WorkspacePathをlist command DTOへ変換する", async () => {
  const commands = createCommands();
  const gateway = createSpecGateway(commands);

  await expect(gateway.listSpecs(workspacePath)).resolves.toEqual({
    ok: true,
    value: tree,
  });
  expect(commands.listSpecs).toHaveBeenCalledWith("/workspace/spec-viewer");
});

test("gatewayはvalidated document identityをread command DTOへ変換する", async () => {
  const commands = createCommands();
  const gateway = createSpecGateway(commands);

  await expect(
    gateway.readSpecDocument({
      workspacePath,
      specId,
      fileKey: "impl",
      correlationId: "document-read-1",
    }),
  ).resolves.toEqual({ ok: true, value: document });
  expect(commands.readSpecFile).toHaveBeenCalledWith({
    workspacePath: "/workspace/spec-viewer",
    specId,
    fileKey: "impl",
    correlationId: "document-read-1",
  });
});

test("gatewayはarchive responseをapplication successへ射影する", async () => {
  const commands = createCommands();
  const gateway = createSpecGateway(commands);

  await expect(gateway.archiveSpec({ workspacePath, specId })).resolves.toEqual(
    { ok: true, value: undefined },
  );
  expect(commands.archiveSpec).toHaveBeenCalledWith({
    workspacePath: "/workspace/spec-viewer",
    specId,
  });
});

test("gatewayはTauri command errorをfeature errorへmappingする", async () => {
  const commands = createCommands();
  const error = new Error("scan failed");
  vi.mocked(commands.listSpecs).mockRejectedValue(error);
  const gateway = createSpecGateway(commands);

  await expect(gateway.listSpecs(workspacePath)).resolves.toEqual({
    ok: false,
    error: toSpecFeatureError("list", error),
  });
});
