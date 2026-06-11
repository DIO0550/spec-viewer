import { expect, test } from "vitest";

import { CommentExport } from "@/features/comments/domain/commentExport";
import { createSpecSkillMcpFeedbackDryRunPayload } from "@/features/comments/lib/mcpFeedback";

test("idleStateは操作なしの初期状態を表す", () => {
  expect(CommentExport.idleState).toEqual({
    status: "idle",
    operation: null,
    message: null,
  });
});

test.each([
  ["savingState", CommentExport.savingState, "saving"],
  ["successState", CommentExport.successState, "success"],
  ["errorState", CommentExport.errorState, "error"],
] as const)("%sは操作とメッセージを持つ状態を作る", (_name, create, status) => {
  expect(create("file", "メッセージ")).toEqual({
    status,
    operation: "file",
    message: "メッセージ",
  });
});

test("createTargetはspec未選択でnullを返す", () => {
  expect(
    CommentExport.createTarget({
      scope: "workspace",
      specId: null,
      fileKey: null,
    }),
  ).toBeNull();
});

test("createTargetはworkspaceスコープでscopeのみ返す", () => {
  expect(
    CommentExport.createTarget({
      scope: "workspace",
      specId: "spec-1",
      fileKey: null,
    }),
  ).toEqual({ scope: "workspace" });
});

test("createTargetはspecスコープでspecIdを含める", () => {
  expect(
    CommentExport.createTarget({
      scope: "spec",
      specId: "spec-1",
      fileKey: null,
    }),
  ).toEqual({ scope: "spec", specId: "spec-1" });
});

test("createTargetはfileスコープでfile未選択ならnullを返す", () => {
  expect(
    CommentExport.createTarget({
      scope: "file",
      specId: "spec-1",
      fileKey: null,
    }),
  ).toBeNull();
});

test("createTargetはfileスコープでspecIdとfileKeyを含める", () => {
  expect(
    CommentExport.createTarget({
      scope: "file",
      specId: "spec-1",
      fileKey: "tasks",
    }),
  ).toEqual({ scope: "file", specId: "spec-1", fileKey: "tasks" });
});

test("formatExportSuccessMessageは件数と保存先を含む", () => {
  expect(
    CommentExport.formatExportSuccessMessage({
      commentCount: 3,
      destinationPath: "/tmp/comments.json",
      format: "json",
    }),
  ).toBe("3件のコメントを/tmp/comments.jsonへexportしました。");
});

test("formatLlmPromptCopySuccessMessageはファイル数とコメント数を含む", () => {
  expect(
    CommentExport.formatLlmPromptCopySuccessMessage({
      prompt: "prompt body",
      contextFileCount: 2,
      commentCount: 5,
    }),
  ).toBe("2ファイル / 5件のコメントを含むLLM promptをコピーしました。");
});

test("formatMcpFeedbackCopySuccessMessageは件数とツール名を含む", () => {
  const payload = createSpecSkillMcpFeedbackDryRunPayload({
    workspacePath: "/workspace/demo",
    specId: "spec-1",
    fileKey: "tasks",
    comments: [],
    generatedAt: "2026-06-11T00:00:00Z",
  });

  expect(CommentExport.formatMcpFeedbackCopySuccessMessage(payload)).toBe(
    "0件のコメントをspec_skill.feedback.submit向けdry-run MCP feedback payloadとしてコピーしました。",
  );
});
