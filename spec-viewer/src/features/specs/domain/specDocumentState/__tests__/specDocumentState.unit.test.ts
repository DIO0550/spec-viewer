import { expect, test } from "vitest";

import { SpecDocumentState } from "@/features/specs/domain/specDocumentState";
import type { SpecDocument } from "@/features/specs/types/spec";

function createDocument(missing: boolean): SpecDocument {
  return {
    key: "design",
    path: "/workspace/spec/design.md",
    contents: missing ? null : "# Design",
    missing,
    blocks: [],
  };
}

const requestContext = {
  workspacePath: "/workspace",
  specId: "spec",
  fileKey: "design",
} as const;

test("fromDocumentは読み込めたファイルをready状態にする", () => {
  const state = SpecDocumentState.fromDocument({
    ...requestContext,
    document: createDocument(false),
  });

  expect(state.status).toBe("ready");
  expect(state.document?.contents).toBe("# Design");
});

test("fromDocumentは欠落ファイルをmissing状態にする", () => {
  const state = SpecDocumentState.fromDocument({
    ...requestContext,
    document: createDocument(true),
  });

  expect(state.status).toBe("missing");
});
