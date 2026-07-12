import { expect, test } from "vitest";

import { toSpecFeatureError } from "@/features/specs/infra/tauri/specErrorMapper";

test.each([
  ["read", "invalidSpec", "specRejected"],
  ["list", "specTreeScan", "treeReadFailed"],
  ["archive", "specArchive", "archiveFailed"],
  ["read", "markdownRead", "documentReadFailed"],
  ["list", "invalidRequest", "requestRejected"],
] as const)("toSpecFeatureErrorは%sの%sをdomain reason %sへ写して表示契約を維持する", (operation, code, expectedReason) => {
  const rawError = { code, message: `specs: ${code}` };

  const result = toSpecFeatureError(operation, rawError);

  expect(result).toMatchObject({
    feature: "specs",
    code,
    message: rawError.message,
    domainError: { reason: expectedReason },
  });
  expect(result.cause).toMatchObject({
    code,
    message: rawError.message,
    cause: rawError,
  });
});

test.each([
  ["list", "workspaceDetection"],
  ["read", "configLoad"],
  ["archive", "unexpected"],
] as const)("toSpecFeatureErrorは%sの非domain wire code %sをunknown表示へ写してraw payloadを保持する", (operation, code) => {
  const rawError = { code, message: `specs: ${code}` };

  const result = toSpecFeatureError(operation, rawError);

  expect(result).toMatchObject({
    feature: "specs",
    code: "unknown",
    message: rawError.message,
    domainError: { reason: "unexpectedFailure" },
  });
  expect(result.cause).toMatchObject({ cause: rawError });
});

test.each([
  ["archive", "archive_spec"],
  ["list", "list_specs"],
  ["read", "read_spec_file"],
] as const)("toSpecFeatureErrorは%sを%s command境界で正規化する", (operation, expectedCommand) => {
  const result = toSpecFeatureError(operation, {
    code: "invalidRequest",
    message: "invalid request",
  });

  expect(result.cause).toMatchObject({ command: expectedCommand });
});
