import { expect, test } from "vitest";

import { toWorkspaceFeatureError } from "@/features/workspace/infra/tauri/workspaceErrorMapper";

test.each([
  ["invalidRequest", "invalidSelection"],
  ["workspaceDetection", "detectionFailed"],
  ["configLoad", "configLoadFailed"],
] as const)("toWorkspaceFeatureErrorは%sをdomain reason %sへ写して表示messageを維持する", (code, expectedReason) => {
  const rawError = { code, message: `workspace: ${code}` };

  const result = toWorkspaceFeatureError(rawError);

  expect(result).toMatchObject({
    feature: "workspace",
    reason: expectedReason,
    message: rawError.message,
    domainError: { reason: expectedReason },
  });
  expect(result.cause).toMatchObject({
    command: "load_workspace",
    code,
    cause: rawError,
  });
});

test.each([
  "unexpected",
] as const)("toWorkspaceFeatureErrorは非domain wire code %sをunexpectedFailureへ写してraw payloadを保持する", (code) => {
  const rawError = { code, message: `workspace: ${code}` };

  const result = toWorkspaceFeatureError(rawError);

  expect(result).toMatchObject({
    feature: "workspace",
    reason: "unexpectedFailure",
    message: rawError.message,
    domainError: { reason: "unexpectedFailure" },
  });
  expect(result.cause).toMatchObject({ cause: rawError });
});

test("toWorkspaceFeatureErrorは未定義wire codeを既存unknown messageへ正規化する", () => {
  const rawError = {
    code: "unknownWireCode",
    message: "workspace: unknownWireCode",
  };

  const result = toWorkspaceFeatureError(rawError);

  expect(result).toMatchObject({
    feature: "workspace",
    reason: "unexpectedFailure",
    message: "Unknown load_workspace failure",
    domainError: { reason: "unexpectedFailure" },
  });
  expect(result.cause).toMatchObject({
    code: "unknown",
    cause: rawError,
  });
});
