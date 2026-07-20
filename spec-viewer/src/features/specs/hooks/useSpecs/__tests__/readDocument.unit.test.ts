import { beforeEach, expect, test, vi } from "vitest";
import { readDocument } from "@/features/specs/hooks/useSpecs/readDocument";
import type { SpecDocument, SpecFileScope } from "@/features/specs/types/spec";
import type { SpecCommands } from "@/lib/api/tauri";

const specCommandMocks = vi.hoisted(() => ({
  readSpecFile: vi.fn<SpecCommands["readSpecFile"]>(),
}));

const performanceMocks = vi.hoisted(() => ({
  startPerformanceSpan: vi.fn(),
  endSpan: vi.fn(),
}));

vi.mock("@/lib/api/tauri", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/api/tauri")>();

  return {
    ...actual,
    specCommands: specCommandMocks,
  };
});

vi.mock("@/lib/performance", () => performanceMocks);

void (specCommandMocks satisfies Pick<SpecCommands, "readSpecFile">);

const target: SpecFileScope = {
  workspacePath: "/workspace/spec-reviewer",
  specId: "phase-1-viewer",
  fileKey: "tasks",
};

const loadedDocument: SpecDocument = {
  key: "tasks",
  path: "/workspace/spec-reviewer/.plugin-workspace/specs/phase-1-viewer/tasks.md",
  contents: "# Tasks",
  missing: false,
  blocks: [],
};

beforeEach(() => {
  specCommandMocks.readSpecFile.mockReset();
  performanceMocks.startPerformanceSpan.mockReset();
  performanceMocks.endSpan.mockReset();
  performanceMocks.startPerformanceSpan.mockReturnValue(
    performanceMocks.endSpan,
  );
});

test("readDocumentはscopeとcorrelationIdをread requestへ渡してdocumentを返す", async () => {
  specCommandMocks.readSpecFile.mockResolvedValue(loadedDocument);

  const result = await readDocument({
    target,
    correlationId: "document-read-success",
  });

  expect(specCommandMocks.readSpecFile).toHaveBeenCalledWith({
    workspacePath: target.workspacePath,
    specId: target.specId,
    fileKey: target.fileKey,
    correlationId: "document-read-success",
  });
  expect(performanceMocks.startPerformanceSpan).toHaveBeenCalledWith(
    "document-read-success",
    "document.read",
    {
      specId: target.specId,
      fileKey: target.fileKey,
    },
  );
  expect(performanceMocks.endSpan).toHaveBeenCalledWith({
    bytes: loadedDocument.contents?.length ?? 0,
    blockCount: loadedDocument.blocks.length,
    missing: loadedDocument.missing,
  });
  expect(result).toEqual({
    status: "success",
    document: loadedDocument,
    correlationId: "document-read-success",
  });
});

test("readDocumentはmissing documentを成功結果として返す", async () => {
  const missingDocument: SpecDocument = {
    ...loadedDocument,
    contents: null,
    missing: true,
  };
  specCommandMocks.readSpecFile.mockResolvedValue(missingDocument);

  const result = await readDocument({
    target,
    correlationId: "document-read-missing",
  });

  expect(result).toEqual({
    status: "success",
    document: missingDocument,
    correlationId: "document-read-missing",
  });
});

test("readDocumentはread command errorをfeature errorへ正規化して返す", async () => {
  const commandError = {
    command: "read_spec_file",
    code: "markdownRead",
    message: "Markdown could not be read",
    raw: { reason: "permission-denied" },
  } as const;
  specCommandMocks.readSpecFile.mockRejectedValue(commandError);

  const result = await readDocument({
    target,
    correlationId: "document-read-error",
  });

  expect(performanceMocks.endSpan).toHaveBeenCalledWith({
    error: true,
  });
  expect(result).toEqual({
    status: "error",
    correlationId: "document-read-error",
    error: {
      feature: "specs",
      code: "markdownRead",
      message: commandError.message,
      cause: commandError,
    },
  });
});
