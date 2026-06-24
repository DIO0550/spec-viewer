import { expect, test } from "vitest";

import type { SpecFile } from "@/features/specs/domain/specFile";
import type { SpecNode } from "@/features/specs/domain/specNode";
import { SpecTreeState } from "@/features/specs/domain/specTreeState";
import type { NormalizedCommandError } from "@/shared/types/ipc";

const implFile: SpecFile = {
  key: "impl",
  label: "Implementation Plan",
  fileName: "implementation-plan.md",
  status: "present",
};

const specNode: SpecNode = {
  id: "spec-1",
  label: "Spec 1",
  files: [implFile],
  children: [],
};

const error: NormalizedCommandError = {
  code: "specTreeScan",
  message: "scan failed",
  raw: "scan failed",
};

test("SpecTreeState.idleはworkspace未選択状態を生成する", () => {
  expect(SpecTreeState.idle()).toEqual({
    status: "idle",
    workspacePath: null,
    tree: null,
    error: null,
  });
});

test("SpecTreeState.loadingは読み込み中状態を生成する", () => {
  expect(SpecTreeState.loading("/workspace/spec-viewer")).toEqual({
    status: "loading",
    workspacePath: "/workspace/spec-viewer",
    tree: null,
    error: null,
  });
});

test("SpecTreeState.loadedはspecがあればready状態を生成する", () => {
  const tree = { specs: [specNode] };

  expect(SpecTreeState.loaded("/workspace/spec-viewer", tree)).toEqual({
    status: "ready",
    workspacePath: "/workspace/spec-viewer",
    tree,
    error: null,
  });
});

test("SpecTreeState.loadedはspecが空ならempty状態を生成する", () => {
  const tree = { specs: [] };

  expect(SpecTreeState.loaded("/workspace/spec-viewer", tree)).toEqual({
    status: "empty",
    workspacePath: "/workspace/spec-viewer",
    tree,
    error: null,
  });
});

test("SpecTreeState.failedは正規化済みエラーを保持する", () => {
  expect(SpecTreeState.failed("/workspace/spec-viewer", error)).toEqual({
    status: "error",
    workspacePath: "/workspace/spec-viewer",
    tree: null,
    error,
  });
});
