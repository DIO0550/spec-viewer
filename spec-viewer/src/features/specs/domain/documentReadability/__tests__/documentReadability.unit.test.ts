import { expect, test } from "vitest";

import { DocumentReadability } from "@/features/specs/domain/documentReadability";
import type { SpecDocumentState } from "@/features/specs/hooks/useSpecs";

const readyState: SpecDocumentState = {
  status: "ready",
  workspacePath: "/workspace/demo",
  specId: "spec-1",
  fileKey: "tasks",
  correlationId: "corr-1",
  document: {
    key: "tasks",
    path: "specs/spec-1/tasks.md",
    format: "markdown",
    contents: "# Tasks",
    missing: false,
    blocks: [],
  },
  error: null,
};

const idleState: SpecDocumentState = {
  status: "idle",
  workspacePath: null,
  specId: null,
  fileKey: null,
  document: null,
  error: null,
};

test("createKeyはready状態で安定したキーを返す", () => {
  expect(DocumentReadability.createKey(readyState)).toBe(
    ["/workspace/demo", "spec-1", "tasks", "corr-1"].join("\u0000"),
  );
});

test("createKeyはcorrelationId未設定でも一意なキーを返す", () => {
  const stateWithoutCorrelation: SpecDocumentState = {
    ...readyState,
    correlationId: undefined,
  };

  expect(DocumentReadability.createKey(stateWithoutCorrelation)).toBe(
    ["/workspace/demo", "spec-1", "tasks", "no-correlation"].join("\u0000"),
  );
});

test("createKeyはready以外の状態でnullを返す", () => {
  expect(DocumentReadability.createKey(idleState)).toBeNull();
});

test("isReadableはmissing状態で常にtrueを返す", () => {
  expect(
    DocumentReadability.isReadable({
      status: "missing",
      currentKey: null,
      readableKey: null,
    }),
  ).toBe(true);
});

test("isReadableは現在のキーが読み取り済みキーと一致するときtrueを返す", () => {
  expect(
    DocumentReadability.isReadable({
      status: "ready",
      currentKey: "key-1",
      readableKey: "key-1",
    }),
  ).toBe(true);
});

test.each([
  ["ready", null, null],
  ["ready", "key-1", null],
  ["ready", "key-1", "key-2"],
] as const)("isReadableは未読み取りのときfalseを返す(current=%s)", (status, currentKey, readableKey) => {
  expect(
    DocumentReadability.isReadable({ status, currentKey, readableKey }),
  ).toBe(false);
});
