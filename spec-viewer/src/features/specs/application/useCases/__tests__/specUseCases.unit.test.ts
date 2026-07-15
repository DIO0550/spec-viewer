import { expect, test, vi } from "vitest";

import type { SpecGateway } from "@/features/specs/application/ports/specGateway";
import { archiveSpec } from "@/features/specs/application/useCases/archiveSpec";
import { listSpecs } from "@/features/specs/application/useCases/listSpecs";
import { readSpecDocument } from "@/features/specs/application/useCases/readSpecDocument";
import { selectSpecFile } from "@/features/specs/application/useCases/selectSpecFile";
import type { SpecDocument } from "@/features/specs/domain/specDocument";
import type { SpecTree } from "@/features/specs/domain/specTree";
import * as TestValues from "@/shared/testing/validatedValueObjects";
import { WorkspacePath } from "@/shared/domain/workspacePath";

const workspacePath = WorkspacePath.fromString("/workspace/spec-reviewer");
const phaseRootId = TestValues.specId("phase-root");
const phaseChildId = TestValues.specId("phase-child");
const tree: SpecTree = {
  specs: [
    {
      id: phaseRootId,
      label: "Phase Root",
      kind: "sourceGroup",
      capabilities: { reviewable: false, archiveable: false },
      files: [],
      children: [
        {
          id: phaseChildId,
          label: "Phase Child",
          kind: "spec",
          capabilities: { reviewable: true, archiveable: true },
          files: [
            {
              key: "design",
              label: "Design",
              fileName: "design.md",
              status: "present",
            },
          ],
          children: [],
        },
      ],
    },
  ],
};
const document: SpecDocument = {
  kind: "markdown",
  key: "design",
  path: "/workspace/spec-reviewer/design.md",
  contents: "# Design",
  blocks: [],
};

function createGateway(overrides: Partial<SpecGateway> = {}): SpecGateway {
  return {
    listSpecs: vi.fn().mockResolvedValue({ ok: true, value: tree }),
    readSpecDocument: vi.fn().mockResolvedValue({ ok: true, value: document }),
    archiveSpec: vi.fn().mockResolvedValue({ ok: true, value: undefined }),
    ...overrides,
  };
}

test("list specs use caseは検証済みWorkspacePathをgatewayへ渡す", async () => {
  const gateway = createGateway();

  const result = await listSpecs(gateway, { workspacePath });

  expect(result).toEqual({ ok: true, value: tree });
  expect(gateway.listSpecs).toHaveBeenCalledWith(workspacePath);
});

test("select spec-file use caseはdomain queryでnested fallbackを解決する", () => {
  const selection = selectSpecFile(tree, {
    kind: "preferred",
    specId: null,
    fileKey: null,
  });

  expect(selection).toEqual({
    spec: tree.specs[0]?.children[0],
    fileKey: "design",
  });
});

test("select spec-file use caseはspec選択時に先頭fileを選ぶ", () => {
  const selection = selectSpecFile(tree, {
    kind: "spec",
    specId: phaseChildId,
  });

  expect(selection.fileKey).toBe("design");
  expect(selection.spec?.id).toBe(phaseChildId);
});

test("read document use caseは検証済みselectionをgatewayへ渡す", async () => {
  const gateway = createGateway();
  const input = {
    workspacePath,
    specId: phaseChildId,
    fileKey: "design" as const,
    correlationId: "document-read-1",
  };

  const result = await readSpecDocument(gateway, input);

  expect(result).toEqual({ ok: true, value: document });
  expect(gateway.readSpecDocument).toHaveBeenCalledWith(input);
});

test("archive spec use caseは検証済みidentityをgatewayへ渡す", async () => {
  const gateway = createGateway();
  const input = { workspacePath, specId: phaseChildId };

  const result = await archiveSpec(gateway, input);

  expect(result).toEqual({ ok: true, value: undefined });
  expect(gateway.archiveSpec).toHaveBeenCalledWith(input);
});
