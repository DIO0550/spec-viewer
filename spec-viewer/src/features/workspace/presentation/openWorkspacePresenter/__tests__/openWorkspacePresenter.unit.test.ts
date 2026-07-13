import { expect, test } from "vitest";

import type { OpenWorkspaceOutcome } from "@/features/workspace/application/openWorkspace";
import { presentOpenWorkspaceOutcome } from "@/features/workspace/presentation/openWorkspacePresenter";
import { workspacePathFixture } from "@/features/workspace/testing/workspacePath";

test.each([
  [
    {
      type: "rejected",
      source: "drop",
      reason: "notDirectory",
    } as const,
    {
      type: "dropError",
      message:
        "ワークスペースフォルダをドロップしてください。ファイルはワークスペースとして開けません。",
    },
  ],
  [
    {
      type: "validationFailed",
      source: "drop",
      cause: new Error("validate boom"),
    } as const,
    { type: "dropError", message: "validate boom" },
  ],
] as const)("drop outcomeをlocalized presentationへ変換する", (outcome, expected) => {
  expect(presentOpenWorkspaceOutcome(outcome)).toEqual(expected);
});

test.each([
  [
    "missing",
    undefined,
    "ワークスペースが見つかりません。保存済み一覧から削除しました。",
  ],
  [
    "unsupported",
    undefined,
    "対応していないワークスペースです。保存済み一覧から削除しました。",
  ],
  [
    "validationFailed",
    new Error("validate boom"),
    "ワークスペースが見つかりません。保存済み一覧から削除しました。 validate boom",
  ],
] as const)("recent %s reasonをlocalized messageとrollback inputへ変換する", (reason, cause, message) => {
  const outcome: OpenWorkspaceOutcome = {
    type: "recentRemoved",
    source: "recent",
    reason,
    ...(cause === undefined ? {} : { cause }),
    removedPath: workspacePathFixture("/recent"),
    rollbackPath: workspacePathFixture("/active"),
  };

  expect(presentOpenWorkspaceOutcome(outcome)).toEqual({
    type: "recentFailure",
    message,
    rollbackInput: "/active",
  });
});

test("startup restore失敗はactive workspaceなしを空inputへrollbackする", () => {
  expect(
    presentOpenWorkspaceOutcome({
      type: "recentRemoved",
      source: "startupRestore",
      reason: "missing",
      removedPath: workspacePathFixture("/recent"),
      rollbackPath: null,
    }),
  ).toEqual({
    type: "recentFailure",
    message: "ワークスペースが見つかりません。保存済み一覧から削除しました。",
    rollbackInput: "",
  });
});

test.each([
  { type: "loaded", source: "input", path: workspacePathFixture("/path") },
  { type: "loadFailedSilently", source: "input" },
  { type: "skipped", source: "drop" },
  {
    type: "rejected",
    source: "input",
    reason: "missingPath",
    error: { reason: "missingWorkspacePath" },
  },
] satisfies readonly OpenWorkspaceOutcome[])("表示不要outcomeはnoneへ変換する", (outcome) => {
  expect(presentOpenWorkspaceOutcome(outcome)).toEqual({ type: "none" });
});
