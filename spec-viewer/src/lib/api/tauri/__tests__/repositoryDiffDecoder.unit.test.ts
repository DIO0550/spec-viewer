import { expect, test } from "vitest";

import {
  decodeCanonicalRevision,
  decodeDiffAnchor,
  decodeIgnoredPage,
  decodeRepositoryFileReview,
  decodeRepositoryOverview,
  InvalidRepositoryDiffResponseError,
} from "@/lib/api/tauri/repositoryDiffDecoder";

const repositoryId = `rr1_${"a".repeat(64)}`;
const snapshotId = `rs1_${"b".repeat(64)}`;

const baseOverview = (
  base: Record<string, unknown>,
  repositoryIdValue: string | null = repositoryId,
  currentSnapshotIdValue: string | null = snapshotId,
): Record<string, unknown> => ({
  repositoryId: repositoryIdValue,
  base,
  currentSnapshotId: currentSnapshotIdValue,
  changed: [],
  changedTree: [],
  allRoot: [],
  all: [],
  ignoredDirectories: [],
  warnings: [],
});

test("resolved base を source と snapshot 付きで decode する", () => {
  const response = baseOverview({
    state: "resolved",
    source: "ghMergeBase",
    branchRef: "refs/heads/main",
    mergeBaseSha: "c".repeat(40),
    headSha: "d".repeat(40),
    reason: null,
    candidates: [],
    overrideRef: null,
  });

  expect(decodeRepositoryOverview(response)).toMatchObject({
    repositoryId,
    currentSnapshotId: snapshotId,
    base: {
      state: "resolved",
      source: "ghMergeBase",
      branchRef: "refs/heads/main",
      mergeBaseSha: "c".repeat(40),
      headSha: "d".repeat(40),
    },
  });
});

test("unbornHead の needsSelection を candidates 付きで decode する", () => {
  const response = baseOverview(
    {
      state: "needsSelection",
      source: null,
      branchRef: null,
      mergeBaseSha: null,
      headSha: null,
      reason: "unbornHead",
      candidates: ["refs/heads/main"],
      overrideRef: null,
    },
    repositoryId,
    null,
  );

  expect(decodeRepositoryOverview(response).base).toEqual({
    state: "needsSelection",
    reason: "unbornHead",
    candidates: ["refs/heads/main"],
  });
});

test("invalidOverride の missingRef を overrideRef 付きで decode する", () => {
  const response = baseOverview(
    {
      state: "invalidOverride",
      source: null,
      branchRef: null,
      mergeBaseSha: null,
      headSha: null,
      reason: "missingRef",
      candidates: [],
      overrideRef: "refs/heads/missing",
    },
    null,
    null,
  );

  expect(decodeRepositoryOverview(response).base).toEqual({
    state: "invalidOverride",
    reason: "missingRef",
    overrideRef: "refs/heads/missing",
  });
});

test.each([
  {
    name: "resolved に source がない",
    base: {
      state: "resolved",
      source: null,
      branchRef: "refs/heads/main",
      mergeBaseSha: "c".repeat(40),
      headSha: "d".repeat(40),
      reason: null,
      candidates: [],
      overrideRef: null,
    },
  },
  {
    name: "needsSelection に branchRef がある",
    base: {
      state: "needsSelection",
      source: null,
      branchRef: "refs/heads/main",
      mergeBaseSha: null,
      headSha: null,
      reason: "unbornHead",
      candidates: [],
      overrideRef: null,
    },
  },
  {
    name: "invalidOverride に candidates がある",
    base: {
      state: "invalidOverride",
      source: null,
      branchRef: null,
      mergeBaseSha: null,
      headSha: null,
      reason: "invalidRef",
      candidates: ["refs/heads/main"],
      overrideRef: "refs/heads/missing",
    },
  },
] as const)("base response の不可能な組み合わせ=$nameをrejectする", ({
  base,
}) => {
  expect(() => decodeRepositoryOverview(baseOverview(base))).toThrow(
    InvalidRepositoryDiffResponseError,
  );
});

const resolvedBase = (): Record<string, unknown> => ({
  state: "resolved",
  source: "main",
  branchRef: "refs/heads/main",
  mergeBaseSha: "c".repeat(40),
  headSha: "d".repeat(40),
  reason: null,
  candidates: [],
  overrideRef: null,
});

test.each([
  {
    name: "resolved に snapshot がない",
    base: resolvedBase(),
    repositoryIdValue: repositoryId,
    currentSnapshotIdValue: null,
  },
  {
    name: "needsSelection に snapshot がある",
    base: {
      state: "needsSelection",
      source: null,
      branchRef: null,
      mergeBaseSha: null,
      headSha: null,
      reason: "unbornHead",
      candidates: ["refs/heads/main"],
      overrideRef: null,
    },
    repositoryIdValue: repositoryId,
    currentSnapshotIdValue: snapshotId,
  },
  {
    name: "invalidOverride に repository identity がある",
    base: {
      state: "invalidOverride",
      source: null,
      branchRef: null,
      mergeBaseSha: null,
      headSha: null,
      reason: "missingRef",
      candidates: [],
      overrideRef: "refs/heads/missing",
    },
    repositoryIdValue: repositoryId,
    currentSnapshotIdValue: snapshotId,
  },
] as const)("base state と repository identity の不整合=$nameをrejectする", ({
  base,
  repositoryIdValue,
  currentSnapshotIdValue,
}) => {
  expect(() =>
    decodeRepositoryOverview(
      baseOverview(base, repositoryIdValue, currentSnapshotIdValue),
    ),
  ).toThrow(InvalidRepositoryDiffResponseError);
});

const changedOverview = (
  file: Record<string, unknown>,
): Record<string, unknown> => ({
  ...baseOverview(resolvedBase()),
  changed: [file],
});

const fileChange = (
  overrides: Readonly<Record<string, unknown>> = {},
): Record<string, unknown> => ({
  oldPath: "src/file.ts",
  newPath: "src/file.ts",
  change: "modified",
  entryKind: "regular",
  contentClassification: "text",
  similarity: null,
  oldMode: null,
  newMode: null,
  ...overrides,
});

test.each([
  { change: "added", oldPath: null, newPath: "src/new.ts", similarity: null },
  {
    change: "untracked",
    oldPath: null,
    newPath: "src/new.ts",
    similarity: null,
  },
  { change: "deleted", oldPath: "src/old.ts", newPath: null, similarity: null },
  {
    change: "modified",
    oldPath: "src/file.ts",
    newPath: "src/file.ts",
    similarity: null,
  },
  {
    change: "typeChanged",
    oldPath: "src/file.ts",
    newPath: "src/file.ts",
    similarity: null,
  },
  {
    change: "renamed",
    oldPath: "src/old.ts",
    newPath: "src/new.ts",
    similarity: 50,
  },
  {
    change: "copied",
    oldPath: "src/old.ts",
    newPath: "src/new.ts",
    similarity: 100,
  },
] as const)("change=%sのold/new path invariantを保持する", (file) => {
  const decoded = decodeRepositoryOverview(changedOverview(fileChange(file)))
    .changed[0];

  expect(decoded).toMatchObject(file);
});

test.each([
  {
    name: "added に oldPath がある",
    overrides: {
      change: "added",
      oldPath: "src/old.ts",
      newPath: "src/new.ts",
    },
  },
  {
    name: "deleted に newPath がある",
    overrides: {
      change: "deleted",
      oldPath: "src/old.ts",
      newPath: "src/new.ts",
    },
  },
  {
    name: "modified の old/new が異なる",
    overrides: {
      change: "modified",
      oldPath: "src/old.ts",
      newPath: "src/new.ts",
    },
  },
  {
    name: "rename の similarity がない",
    overrides: {
      change: "renamed",
      oldPath: "src/old.ts",
      newPath: "src/new.ts",
      similarity: null,
    },
  },
  {
    name: "modified に similarity がある",
    overrides: {
      change: "modified",
      oldPath: "src/file.ts",
      newPath: "src/file.ts",
      similarity: 80,
    },
  },
  {
    name: "path が repository-relative でない",
    overrides: { oldPath: "../outside.ts", newPath: "../outside.ts" },
  },
] as const)("不正な file change=%sをrejectする", ({ overrides }) => {
  expect(() =>
    decodeRepositoryOverview(changedOverview(fileChange(overrides))),
  ).toThrow(InvalidRepositoryDiffResponseError);
});

const fileReviewResponse = (): Record<string, unknown> => ({
  file: fileChange(),
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

test.each([
  "text",
  "binary",
  "notApplicable",
  "unknown",
] as const)("content classification=%sをfile reviewで保持する", (contentClassification) => {
  const response = fileReviewResponse();
  response.file = fileChange({ contentClassification });

  expect(decodeRepositoryFileReview(response).file.contentClassification).toBe(
    contentClassification,
  );
});

test.each([
  "binary",
  "largeFile",
  "diffLimit",
  "missingSide",
  "unsupportedEntryKind",
] as const)("omission reason=%sをcontentで保持する", (reason) => {
  const response = fileReviewResponse();
  response.oldContent = {
    state: "omitted",
    text: null,
    reason,
    byteLength: 42,
  };

  expect(decodeRepositoryFileReview(response).oldContent).toEqual(
    response.oldContent,
  );
});

test.each([
  "context",
  "added",
  "removed",
  "noNewline",
] as const)("hunk line kind=%sをdecodeしてline numberを導出する", (kind) => {
  const response = fileReviewResponse();
  response.structuredDiff = {
    state: "available",
    reason: null,
    hunks: [{ header: "@@ -2,1 +3,1 @@", lines: [{ kind, text: "line" }] }],
  };

  const hunk = decodeRepositoryFileReview(response).structuredDiff.hunks[0];
  expect(hunk?.lines[0]?.kind).toBe(kind);
});

test("omitted structured diff は空 hunks と reason を保持する", () => {
  const response = fileReviewResponse();
  response.structuredDiff = {
    state: "omitted",
    hunks: [],
    reason: "diffLimit",
  };

  expect(decodeRepositoryFileReview(response).structuredDiff).toEqual(
    response.structuredDiff,
  );
});

test("submodule metadata と boolean flags を欠落なくdecodeする", () => {
  const response = fileReviewResponse();
  response.submodule = {
    baseGitlinkOid: null,
    indexGitlinkOid: "abc123",
    worktreeHeadOid: null,
    commitChanged: true,
    trackedChanges: false,
    untrackedChanges: true,
    uninitialized: false,
  };

  expect(decodeRepositoryFileReview(response).submodule).toEqual(
    response.submodule,
  );
});

const nodeId = `in1_${"e".repeat(64)}`;

const treeNode = (
  overrides: Readonly<Record<string, unknown>> = {},
): Record<string, unknown> => ({
  path: "generated",
  name: "generated",
  kind: "directory",
  entryKind: null,
  change: null,
  ignored: true,
  children: { state: "deferred", nodeId },
  ...overrides,
});

test("loaded tree と deferred ignored directory を decodeする", () => {
  const response = {
    ...baseOverview(resolvedBase()),
    changedTree: [
      treeNode({
        path: "src",
        name: "src",
        kind: "directory",
        ignored: false,
        children: { state: "loaded", items: [] },
      }),
    ],
    allRoot: [treeNode()],
  };

  const decoded = decodeRepositoryOverview(response);
  expect(decoded.changedTree[0]?.children).toEqual({
    state: "loaded",
    items: [],
  });
  expect(decoded.allRoot[0]).toMatchObject({
    path: "generated",
    ignored: true,
    children: { state: "deferred", nodeId },
  });
});

test("ignored page は nodeId・entries・nextCursor をdecodeする", () => {
  const response = {
    nodeId,
    entries: [
      treeNode({
        path: "generated/build.log",
        name: "build.log",
        kind: "file",
        entryKind: "regular",
        ignored: true,
        children: { state: "loaded", items: [] },
      }),
    ],
    nextCursor: "ic1_cursor",
  };

  expect(decodeIgnoredPage(response)).toEqual(response);
});

const diffAnchor = (
  overrides: Readonly<Record<string, unknown>> = {},
): Record<string, unknown> => ({
  repositoryId,
  worktreeId: "/workspace",
  side: "base",
  oldPath: "src/old.ts",
  newPath: null,
  line: 2,
  baseSha: "c".repeat(40),
  currentSnapshotId: snapshotId,
  lineHash: "e".repeat(64),
  snippet: "line",
  context: "context",
  ...overrides,
});

test.each([
  "0",
  "1",
  "18446744073709551615",
] as const)("canonical revision=%sをnumber化せずdecodeする", (revision) => {
  expect(decodeCanonicalRevision(revision, "revision", revision)).toBe(
    revision,
  );
});

test.each([
  "-1",
  "01",
  "1.0",
  "not-a-number",
  "18446744073709551616",
] as const)("不正なcanonical revision=%sをrejectする", (revision) => {
  const decode = (): string =>
    decodeCanonicalRevision(revision, "revision", revision);
  expect(decode).toThrow(InvalidRepositoryDiffResponseError);
  expect(decode).toThrowError(
    expect.objectContaining({ code: "invalidRevision" }),
  );
});
test.each([
  { side: "base", oldPath: "src/old.ts", newPath: null },
  { side: "current", oldPath: null, newPath: "src/new.ts" },
] as const)("side=%sのDiff anchor path invariantを保持する", (anchor) => {
  expect(decodeDiffAnchor(diffAnchor(anchor))).toMatchObject(anchor);
});

test.each([
  { side: "base", oldPath: null, newPath: null },
  { side: "current", oldPath: "src/old.ts", newPath: null },
] as const)("path が不足した side=%s のDiff anchorをrejectする", (anchor) => {
  expect(() => decodeDiffAnchor(diffAnchor(anchor))).toThrow(
    InvalidRepositoryDiffResponseError,
  );
});
