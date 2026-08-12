import { expect, test } from "vitest";

import {
  decodeDiffCommentDocument,
  decodeDiffCommentMutationOutcome,
  InvalidDiffCommentResponseError,
} from "@/lib/api/tauri/diffCommentDecoder";

const identity = {
  repositoryId: `rr1_${"a".repeat(64)}`,
  worktreeId: `rw1_${"b".repeat(64)}`,
  baseSha: "c".repeat(40),
  currentSnapshotId: `rs1_${"d".repeat(64)}`,
} as const;

const anchor = {
  ...identity,
  side: "current",
  newPath: "src/main.ts",
  line: 3,
  lineHash: `sha256:${"e".repeat(64)}`,
  snippet: "return value;",
  contextBefore: ["if (ready) {"],
  contextAfter: ["}"],
} as const;

const comment = {
  id: "cmt_1",
  body: "境界を確認してください",
  resolved: false,
  createdAt: "2026-08-11T00:00:00Z",
  anchor,
  anchorResolution: {
    status: "exact",
    selectionPath: "src/main.ts",
    sidePath: "src/main.ts",
    side: "current",
    line: 3,
  },
} as const;

const document = {
  version: 1,
  repositoryId: identity.repositoryId,
  worktreeId: identity.worktreeId,
  revision: "7",
  comments: [comment],
  resolutionWarnings: [],
} as const;

test("Diff comment documentの2値scopeとhistorical anchorをdecodeする", () => {
  expect(decodeDiffCommentDocument(document)).toEqual(document);
});

test("historical anchorのbaseとsnapshotが現在document scopeと独立していてもdecodeする", () => {
  const historicalAnchor = {
    ...anchor,
    baseSha: "f".repeat(40),
    currentSnapshotId: `rs1_${"1".repeat(64)}`,
  };
  const candidate = {
    ...document,
    comments: [{ ...comment, anchor: historicalAnchor }],
  };

  expect(decodeDiffCommentDocument(candidate).comments[0]?.anchor).toEqual(
    historicalAnchor,
  );
});

test.each([
  { ...document, retired: true },
  { ...document, comments: [{ ...comment, status: "open" }] },
  {
    ...document,
    comments: [{ ...comment, anchor: { ...anchor, context: "x" } }],
  },
  {
    ...document,
    comments: [
      {
        ...comment,
        anchorResolution: { ...comment.anchorResolution, canJump: true },
      },
    ],
  },
  {
    ...document,
    resolutionWarnings: [{ code: "io", message: "warning", extra: true }],
  },
] as const)("unknownまたはretired response fieldを拒否する", (candidate) => {
  expect(() => decodeDiffCommentDocument(candidate)).toThrow(
    InvalidDiffCommentResponseError,
  );
});

test.each([
  { field: "repositoryId", value: `repo_${"a".repeat(64)}` },
  { field: "worktreeId", value: `wt1_${"b".repeat(64)}` },
  { field: "baseSha", value: "A".repeat(40) },
  { field: "currentSnapshotId", value: `snapshot_${"d".repeat(64)}` },
  { field: "lineHash", value: `hash-${"e".repeat(64)}` },
] as const)("非canonical anchor $field を拒否する", ({ field, value }) => {
  expect(() =>
    decodeDiffCommentDocument({
      ...document,
      comments: [{ ...comment, anchor: { ...anchor, [field]: value } }],
    }),
  ).toThrow(InvalidDiffCommentResponseError);
});

test.each([
  "/absolute.ts",
  "../escape.ts",
  "src\\escape.ts",
  "src/\0x.ts",
])("不正repository path %sを拒否する", (newPath) => {
  expect(() =>
    decodeDiffCommentDocument({
      ...document,
      comments: [{ ...comment, anchor: { ...anchor, newPath } }],
    }),
  ).toThrow(InvalidDiffCommentResponseError);
});

test.each([
  {
    status: "stale",
    reason: "ambiguousContext",
    candidateCount: 2,
  },
  { status: "unavailable", reason: "cancelled", canJump: false },
] as const)("runtime resolution $statusをdecodeする", (anchorResolution) => {
  const candidate = {
    ...document,
    comments: [{ ...comment, anchorResolution }],
  };

  expect(
    decodeDiffCommentDocument(candidate).comments[0]?.anchorResolution,
  ).toEqual(anchorResolution);
});

test.each([
  "01",
  "18446744073709551616",
  1,
] as const)("非canonical revision=%sを拒否する", (revision) => {
  expect(() => decodeDiffCommentDocument({ ...document, revision })).toThrow(
    InvalidDiffCommentResponseError,
  );
});

test.each([
  { status: "stale", reason: "ambiguousContext", candidateCount: -1 },
  { status: "stale", reason: "ambiguousContext", candidateCount: 2 ** 32 },
  { status: "unavailable", reason: "cancelled", canJump: true },
] as const)("不正なruntime resolutionを拒否する", (anchorResolution) => {
  expect(() =>
    decodeDiffCommentDocument({
      ...document,
      comments: [{ ...comment, anchorResolution }],
    }),
  ).toThrow(InvalidDiffCommentResponseError);
});

test("committed outcomeはdocumentと重複revision/warningsが一致するときdecodeする", () => {
  const outcome = {
    kind: "committed",
    document,
    revision: "7",
    resolutionWarnings: [],
    durability: "durable",
  } as const;

  expect(decodeDiffCommentMutationOutcome(outcome)).toEqual(outcome);
});

test("committed outcomeの重複revision不一致を拒否する", () => {
  expect(() =>
    decodeDiffCommentMutationOutcome({
      kind: "committed",
      document,
      revision: "8",
      resolutionWarnings: [],
      durability: "durable",
    }),
  ).toThrow(InvalidDiffCommentResponseError);
});

test("mutation outcomeのvariant外fieldを拒否する", () => {
  expect(() =>
    decodeDiffCommentMutationOutcome({
      kind: "preCommitFailure",
      code: "storeBusy",
      retryable: true,
      currentRevision: "7",
    }),
  ).toThrow(InvalidDiffCommentResponseError);
});

test("revisionOverflowはcurrent document/revision付き非retryとしてdecodeする", () => {
  const outcome = {
    kind: "preCommitFailure",
    code: "revisionOverflow",
    currentDocument: document,
    currentRevision: "7",
    retryable: false,
  } as const;

  expect(decodeDiffCommentMutationOutcome(outcome)).toEqual(outcome);
});

test.each([
  { code: "storeBusy", retryable: false },
  { code: "permission", retryable: true },
] as const)("preCommit code/retryableの不整合を拒否する", (failure) => {
  expect(() =>
    decodeDiffCommentMutationOutcome({
      kind: "preCommitFailure",
      ...failure,
    }),
  ).toThrow(InvalidDiffCommentResponseError);
});
