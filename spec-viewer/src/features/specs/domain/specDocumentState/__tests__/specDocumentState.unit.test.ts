import { expect, test } from "vitest";
import { SpecDocument } from "@/features/specs/domain/specDocument";
import { SpecDocumentState } from "@/features/specs/domain/specDocumentState";
import * as TestValues from "@/shared/testing/validatedValueObjects";
import type { IpcCommandError } from "@/shared/types/ipc";

const document = SpecDocument.loaded({
  key: "impl",
  format: "markdown",
  path: "/workspace/spec-viewer/.plugin-workspace/.specs/001/implementation-plan.md",
  contents: "# Plan",
  blocks: [],
});

const missingDocument = SpecDocument.missing({
  key: "impl",
  format: "markdown",
  path: "/workspace/spec-viewer/.plugin-workspace/.specs/001/implementation-plan.md",
});

const error: IpcCommandError = {
  code: "markdownRead",
  message: "read failed",
  raw: "read failed",
};

test("SpecDocumentState.idleは選択なし状態を生成する", () => {
  expect(SpecDocumentState.idle(null)).toEqual({
    status: "idle",
    workspacePath: null,
    specId: null,
    fileKey: null,
    document: null,
    error: null,
  });
});

test("SpecDocumentState.idleは任意の選択contextを保持する", () => {
  expect(
    SpecDocumentState.idle(
      "/workspace/spec-viewer",
      TestValues.specId("spec-1"),
      "tasks",
    ),
  ).toEqual({
    status: "idle",
    workspacePath: "/workspace/spec-viewer",
    specId: TestValues.specId("spec-1"),
    fileKey: "tasks",
    document: null,
    error: null,
  });
});

test("SpecDocumentState.loadingはcorrelation id付きの読み込み中状態を生成する", () => {
  expect(
    SpecDocumentState.loading(
      "/workspace/spec-viewer",
      TestValues.specId("spec-1"),
      "impl",
      "document-read-1",
    ),
  ).toEqual({
    status: "loading",
    workspacePath: "/workspace/spec-viewer",
    specId: TestValues.specId("spec-1"),
    fileKey: "impl",
    correlationId: "document-read-1",
    document: null,
    error: null,
  });
});

test("SpecDocumentState.loadedはMarkdownならready状態を生成する", () => {
  expect(
    SpecDocumentState.loaded(
      "/workspace/spec-viewer",
      TestValues.specId("spec-1"),
      document,
      { loadRevision: "load-1", correlationId: "document-read-1" },
    ),
  ).toEqual({
    status: "ready",
    workspacePath: "/workspace/spec-viewer",
    specId: TestValues.specId("spec-1"),
    fileKey: "impl",
    correlationId: "document-read-1",
    loadRevision: "load-1",
    document,
    error: null,
  });
});

test("SpecDocumentState.loadedはMissing variantならmissing状態を生成する", () => {
  expect(
    SpecDocumentState.loaded(
      "/workspace/spec-viewer",
      TestValues.specId("spec-1"),
      missingDocument,
      { loadRevision: "load-2" },
    ),
  ).toEqual({
    status: "missing",
    workspacePath: "/workspace/spec-viewer",
    specId: TestValues.specId("spec-1"),
    fileKey: "impl",
    loadRevision: "load-2",
    document: missingDocument,
    error: null,
  });
});

test("SpecDocumentState.failedは正規化済みエラーとcorrelation idを保持する", () => {
  expect(
    SpecDocumentState.failed(
      "/workspace/spec-viewer",
      TestValues.specId("spec-1"),
      "impl",
      error,
      "document-read-1",
    ),
  ).toEqual({
    status: "error",
    workspacePath: "/workspace/spec-viewer",
    specId: TestValues.specId("spec-1"),
    fileKey: "impl",
    correlationId: "document-read-1",
    document: null,
    error,
  });
});
