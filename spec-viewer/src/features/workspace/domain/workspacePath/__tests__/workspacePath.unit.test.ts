import { assert, expect, test } from "vitest";

import { WorkspacePath } from "@/features/workspace/domain/workspacePath";

test.each([
  [" /workspace/spec-viewer/// ", "/workspace/spec-viewer"],
  ["C:\\workspace\\spec-viewer\\", "C:/workspace/spec-viewer"],
  ["/", "/"],
  ["C:\\", "C:/"],
  ["\\\\server\\share\\spec-viewer\\", "//server/share/spec-viewer"],
])("workspace pathはseparatorと末尾separatorを正規化する", (raw, expected) => {
  expect(WorkspacePath.parse(raw)).toEqual({ ok: true, path: expected });
});

test.each([
  ["file:///workspace/spec%20viewer/", "/workspace/spec viewer"],
  ["file:///C:/Users/Alice/spec-viewer/", "C:/Users/Alice/spec-viewer"],
  ["file://server/share/spec-viewer/", "//server/share/spec-viewer"],
])("workspace pathはfile URLをcanonical pathへ変換する", (raw, expected) => {
  expect(WorkspacePath.parse(raw)).toEqual({ ok: true, path: expected });
});

test.each([
  "",
  "   ",
  "\t\n",
])("workspace pathは空入力をtyped errorで拒否する", (raw) => {
  expect(WorkspacePath.parse(raw)).toEqual({
    ok: false,
    error: { reason: "missingWorkspacePath" },
  });
});

test("workspace pathは不正なfile URLをtyped errorで拒否する", () => {
  expect(WorkspacePath.parse("file://%")).toEqual({
    ok: false,
    error: { reason: "invalidWorkspaceFileUrl" },
  });
});

test("workspace pathは異なる入力形式をcanonical valueとして比較する", () => {
  const unixPath = WorkspacePath.parse("/workspace/spec-viewer/");
  const fileUrl = WorkspacePath.parse("file:///workspace/spec-viewer");

  assert(unixPath.ok);
  assert(fileUrl.ok);

  expect(WorkspacePath.equals(unixPath.path, fileUrl.path)).toBe(true);
});

test.each([
  ["/workspace/spec-viewer", "spec-viewer"],
  ["C:/workspace/spec-viewer", "spec-viewer"],
  ["/", "/"],
  ["C:/", "C:/"],
] as const)("workspace pathはcanonical pathから表示名を返す", (raw, expected) => {
  const result = WorkspacePath.parse(raw);

  assert(result.ok);

  expect(WorkspacePath.displayName(result.path)).toBe(expected);
});
