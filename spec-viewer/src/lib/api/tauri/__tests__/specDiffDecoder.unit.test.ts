import { expect, test } from "vitest";

import {
  decodeChangedSpecFiles,
  decodeSpecFileDiff,
} from "@/lib/api/tauri/specDiffDecoder";

import {
  createMinimalDetailResponse,
  createMinimalListResponse,
} from "./specDiffTestFixtures";

test("decodeChangedSpecFilesは最小の変更一覧responseをdecodeする", () => {
  const response = createMinimalListResponse();

  expect(decodeChangedSpecFiles(response)).toEqual(response);
});

test("decodeSpecFileDiffはtext contentと空hunksとnull submoduleをdecodeする", () => {
  const response = createMinimalDetailResponse();

  expect(decodeSpecFileDiff(response)).toMatchObject({
    identity: { sourceId: "spec:077-issue-166", path: "tasks" },
    review: response.review,
    availability: { kind: "empty" },
  });
});

test.each([
  "added",
  "modified",
  "deleted",
  "renamed",
  "copied",
  "typeChanged",
  "untracked",
] as const)("decodeChangedSpecFilesはchange=%sを保持する", (change) => {
  const response = createMinimalListResponse();
  response.files[0].change = change;

  expect(decodeChangedSpecFiles(response).files[0]?.change).toBe(change);
});

test.each([
  "context",
  "added",
  "removed",
  "noNewline",
] as const)("decodeSpecFileDiffはline kind=%sを保持する", (kind) => {
  const response = createMinimalDetailResponse();
  response.review.structuredDiff.hunks = [
    { header: "@@ -1 +1 @@", lines: [{ kind, text: "line" }] },
  ];

  const decoded = decodeSpecFileDiff(response);
  expect(decoded.review.structuredDiff.state).toBe("available");
  expect(decoded.review.structuredDiff.hunks[0]?.lines[0]?.kind).toBe(kind);
});

test.each([
  "regular",
  "symlink",
  "submodule",
] as const)("decodeSpecFileDiffはentry kind=%sを保持する", (entryKind) => {
  const response = createMinimalDetailResponse();
  response.review.file.entryKind = entryKind;

  expect(decodeSpecFileDiff(response).review.file.entryKind).toBe(entryKind);
});

test.each([
  "text",
  "binary",
  "notApplicable",
  "unknown",
] as const)("decodeSpecFileDiffはcontent classification=%sを保持する", (contentClassification) => {
  const response = createMinimalDetailResponse();
  response.review.file.contentClassification = contentClassification;

  expect(decodeSpecFileDiff(response).review.file.contentClassification).toBe(
    contentClassification,
  );
});

test.each([
  "binary",
  "largeFile",
  "diffLimit",
  "missingSide",
  "unsupportedEntryKind",
] as const)("decodeSpecFileDiffはomission reason=%sを保持する", (reason) => {
  const response = createMinimalDetailResponse();
  response.review.oldContent.reason = reason;

  expect(decodeSpecFileDiff(response).review.oldContent.reason).toBe(reason);
});

test("decodeSpecFileDiffはomitted・nullable・submoduleを欠落なく保持する", () => {
  const response = createMinimalDetailResponse();
  response.review.file.oldPath = "old/tasks.md";
  response.review.file.newPath = null;
  response.review.file.similarity = 50;
  response.review.file.oldMode = "100644";
  response.review.file.newMode = null;
  response.review.oldContent = {
    state: "omitted",
    text: null,
    reason: "binary",
    byteLength: 42,
  };
  response.review.patch = {
    state: "omitted",
    text: null,
    reason: "diffLimit",
    byteLength: 84,
  };
  response.review.structuredDiff = {
    state: "omitted",
    hunks: [],
    reason: "diffLimit",
  };
  response.review.submodule = {
    baseGitlinkOid: null,
    indexGitlinkOid: "abc123",
    worktreeHeadOid: null,
    commitChanged: true,
    trackedChanges: false,
    untrackedChanges: true,
    uninitialized: false,
  };

  expect(decodeSpecFileDiff(response)).toMatchObject({
    identity: { sourceId: "spec:077-issue-166", path: "tasks" },
    review: response.review,
    availability: { kind: "omitted", reason: "diffLimit" },
  });
});
