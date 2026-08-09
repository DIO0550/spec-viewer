import { invoke } from "@tauri-apps/api/core";
import { expect, test, vi } from "vitest";

import {
  loadRepositoryDiff,
  loadRepositoryFile,
  traverseRepositoryIgnored,
} from "@/lib/api/tauri/repositoryDiff";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

const invokeMock = vi.mocked(invoke);
const repositoryId = `rr1_${"a".repeat(64)}`;
const snapshotId = `rs1_${"b".repeat(64)}`;
const nodeId = `in1_${"c".repeat(64)}`;

const overviewResponse = (): Record<string, unknown> => ({
  repositoryId,
  base: {
    state: "resolved",
    source: "main",
    branchRef: "refs/heads/main",
    mergeBaseSha: "d".repeat(40),
    headSha: "e".repeat(40),
    reason: null,
    candidates: [],
    overrideRef: null,
  },
  currentSnapshotId: snapshotId,
  changed: [],
  changedTree: [],
  allRoot: [],
  all: [],
  ignoredDirectories: [],
  warnings: [],
});

const ignoredPageResponse = (): Record<string, unknown> => ({
  nodeId,
  entries: [],
  nextCursor: null,
});

const fileReviewResponse = (): Record<string, unknown> => ({
  file: {
    oldPath: "src/file.ts",
    newPath: "src/file.ts",
    change: "modified",
    entryKind: "regular",
    contentClassification: "text",
    similarity: null,
    oldMode: null,
    newMode: null,
  },
  oldContent: {
    state: "available",
    text: "old",
    reason: null,
    byteLength: null,
  },
  newContent: {
    state: "available",
    text: "new",
    reason: null,
    byteLength: null,
  },
  patch: { state: "available", text: "patch", reason: null, byteLength: null },
  structuredDiff: { state: "available", hunks: [], reason: null },
  submodule: null,
});

test("loadRepositoryDiff は exact command/request で overview をdecodeする", async () => {
  const response = overviewResponse();
  invokeMock.mockReset();
  invokeMock.mockResolvedValue(response);

  await expect(
    loadRepositoryDiff({
      worktreeId: "/workspace",
      baseOverride: "refs/heads/main",
    }),
  ).resolves.toMatchObject({ repositoryId, currentSnapshotId: snapshotId });
  expect(invokeMock).toHaveBeenCalledWith("load_repository_diff", {
    request: {
      worktreeId: "/workspace",
      baseOverride: "refs/heads/main",
    },
  });
});

test("traverseRepositoryIgnored は snapshot/node/cursor を渡してdecodeする", async () => {
  const response = ignoredPageResponse();
  invokeMock.mockReset();
  invokeMock.mockResolvedValue(response);

  await expect(
    traverseRepositoryIgnored({
      worktreeId: "/workspace",
      currentSnapshotId: snapshotId,
      nodeId,
      cursor: "ic1_cursor",
    }),
  ).resolves.toEqual(response);
  expect(invokeMock).toHaveBeenCalledWith("traverse_repository_ignored", {
    request: {
      worktreeId: "/workspace",
      currentSnapshotId: snapshotId,
      nodeId,
      cursor: "ic1_cursor",
    },
  });
});

test("loadRepositoryFile は path と snapshot を渡して review をdecodeする", async () => {
  const response = fileReviewResponse();
  invokeMock.mockReset();
  invokeMock.mockResolvedValue(response);

  await expect(
    loadRepositoryFile({
      worktreeId: "/workspace",
      currentSnapshotId: snapshotId,
      path: "src/file.ts",
    }),
  ).resolves.toMatchObject({ file: response.file });
  expect(invokeMock).toHaveBeenCalledWith("load_repository_file", {
    request: {
      worktreeId: "/workspace",
      currentSnapshotId: snapshotId,
      path: "src/file.ts",
    },
  });
});

test.each([
  "invalidInput",
  "invalidOverride",
  "unbornHead",
  "headChangedDuringRead",
  "notRepository",
  "bareRepository",
  "worktreeUnavailable",
  "commonDirBoundaryEscape",
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
  "staleCursor",
  "invalidCursor",
  "entryChangedDuringRead",
  "permissionDenied",
  "io",
] as const)("repository command error=%sを保持する", async (code) => {
  const raw = { code, message: code + " failure" };
  invokeMock.mockReset();
  invokeMock.mockRejectedValue(raw);

  await expect(
    loadRepositoryDiff({ worktreeId: "/workspace" }),
  ).rejects.toEqual({
    command: "load_repository_diff",
    code,
    message: code + " failure",
    raw,
  });
});

test("unknown rejection は unknown command error にする", async () => {
  const raw = new Error("invoke failed");
  invokeMock.mockReset();
  invokeMock.mockRejectedValue(raw);

  await expect(
    loadRepositoryFile({
      worktreeId: "/workspace",
      currentSnapshotId: snapshotId,
      path: "src/file.ts",
    }),
  ).rejects.toEqual({
    command: "load_repository_file",
    code: "unknown",
    message: "invoke failed",
    raw,
  });
});

test("malformed success response は invalidResponse にする", async () => {
  const raw = { repositoryId, base: null };
  invokeMock.mockReset();
  invokeMock.mockResolvedValue(raw);

  await expect(
    loadRepositoryDiff({ worktreeId: "/workspace" }),
  ).rejects.toMatchObject({
    command: "load_repository_diff",
    code: "invalidResponse",
    raw,
  });
});
