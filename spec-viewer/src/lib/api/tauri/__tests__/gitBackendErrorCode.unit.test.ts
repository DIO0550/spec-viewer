import { expect, test } from "vitest";

import {
  GIT_BACKEND_ERROR_CODES,
  isGitBackendErrorCode,
} from "@/lib/api/tauri/gitBackendErrorCode";
import { SPEC_DIFF_BACKEND_ERROR_CODES } from "@/lib/api/tauri/listChangedSpecFiles";

const SHARED_CODES = [
  "invalidInput",
  "notRepository",
  "bareRepository",
  "worktreeUnavailable",
  "commonDirBoundaryEscape",
  "unbornHead",
  "headChangedDuringRead",
  "gitUnavailable",
  "gitTimedOut",
  "gitOutputLimitExceeded",
  "gitFailed",
  "unsupportedPathEncoding",
  "revisionNotFound",
  "revisionNotCommit",
  "invalidHistoryOutput",
  "invalidRepositoryPath",
  "staleBase",
  "staleSnapshot",
  "entryChangedDuringRead",
  "permissionDenied",
  "io",
] as const;

const SPEC_ONLY_CODES = ["workspaceDetection", "configLoad", "specTreeScan"];
const REPOSITORY_ONLY_CODES = [
  "invalidOverride",
  "staleCursor",
  "invalidCursor",
];

test.each(
  SHARED_CODES,
)("isGitBackendErrorCodeは共有backend code=%sをtrueと判定する", (code) => {
  expect(isGitBackendErrorCode(code)).toBe(true);
});

test("GIT_BACKEND_ERROR_CODESは重複なく21要素である", () => {
  expect(GIT_BACKEND_ERROR_CODES).toHaveLength(21);
  expect(new Set(GIT_BACKEND_ERROR_CODES).size).toBe(21);
});

test.each(
  SPEC_ONLY_CODES,
)("isGitBackendErrorCodeはSpec固有code=%sをfalseと判定する", (code) => {
  expect(isGitBackendErrorCode(code)).toBe(false);
});

test.each(
  REPOSITORY_ONLY_CODES,
)("isGitBackendErrorCodeはrepository固有code=%sをfalseと判定する", (code) => {
  expect(isGitBackendErrorCode(code)).toBe(false);
});

test.each([
  { name: "未知の文字列", value: "somethingElse" },
  { name: "null", value: null },
  { name: "数値", value: 42 },
  { name: "undefined", value: undefined },
  { name: "配列", value: [] },
])("isGitBackendErrorCodeは$nameをfalseと判定する", ({ value }) => {
  expect(isGitBackendErrorCode(value)).toBe(false);
});

test("SPEC_DIFF_BACKEND_ERROR_CODESは共有21とSpec固有3の合成として24要素になる", () => {
  expect(SPEC_DIFF_BACKEND_ERROR_CODES).toHaveLength(24);
  expect(new Set(SPEC_DIFF_BACKEND_ERROR_CODES)).toEqual(
    new Set([...SHARED_CODES, ...SPEC_ONLY_CODES]),
  );
});
