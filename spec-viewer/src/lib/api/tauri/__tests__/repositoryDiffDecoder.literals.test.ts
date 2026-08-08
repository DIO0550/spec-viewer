import { expect, test } from "vitest";

import { InvalidDiffResponseError } from "@/lib/api/tauri/diffPayloadDecoder";
import {
  decodeRepositoryDiffOverview,
  decodeRepositoryFileReview,
} from "@/lib/api/tauri/repositoryDiffDecoder";

import {
  createFileChangeFixture,
  createFileTreeNodeFixture,
  createInvalidOverrideBaseResponse,
  createMinimalFileReviewResponse,
  createMinimalOverviewResponse,
} from "./repositoryDiffTestFixtures";

test.each([
  "notFound",
  "detachedHead",
  "noCommonAncestor",
])("invalidOverrideはBaseResolutionFailureのreason=%sを拒否する", (reason) => {
  const response = createMinimalOverviewResponse();
  response.base = createInvalidOverrideBaseResponse();
  response.base.reason = reason;

  expect(() => decodeRepositoryDiffOverview(response)).toThrowError(
    /base\.reason must be one of invalidRef\|missingRef/,
  );
});

test.each([
  { name: "file status", field: "change", value: "renamedAndModified" },
  { name: "entryKind", field: "entryKind", value: "fifo" },
  {
    name: "contentClassification",
    field: "contentClassification",
    value: "utf16",
  },
] as const)("changedの未知の$nameを拒否する", ({ field, value }) => {
  const response = createMinimalOverviewResponse();
  response.changed = [{ ...createFileChangeFixture(), [field]: value }];

  expect(() => decodeRepositoryDiffOverview(response)).toThrowError(
    InvalidDiffResponseError,
  );
});

test("TreeNodeの未知のkindを拒否する", () => {
  const response = createMinimalOverviewResponse();
  response.allRoot = [{ ...createFileTreeNodeFixture(), kind: "socket" }];

  expect(() => decodeRepositoryDiffOverview(response)).toThrowError(
    /kind must be one of file\|directory/,
  );
});

test("TreeNodeの未知のchangeを拒否する", () => {
  const response = createMinimalOverviewResponse();
  response.allRoot = [{ ...createFileTreeNodeFixture(), change: "moved" }];

  expect(() => decodeRepositoryDiffOverview(response)).toThrowError(
    /change must be one of/,
  );
});

test("未知のomissionReasonを拒否する", () => {
  const response = createMinimalFileReviewResponse();
  response.structuredDiff = { state: "omitted", hunks: [], reason: "tooDeep" };

  expect(() => decodeRepositoryFileReview(response)).toThrowError(
    /reason must be one of/,
  );
});

test("未知のlineKindを拒否する", () => {
  const response = createMinimalFileReviewResponse();
  response.structuredDiff.hunks = [
    { header: "@@ -1 +1 @@", lines: [{ kind: "moved", text: "x" }] },
  ];

  expect(() => decodeRepositoryFileReview(response)).toThrowError(
    /kind must be one of context\|added\|removed\|noNewline/,
  );
});

test("hunk headerの文法違反を拒否する", () => {
  const response = createMinimalFileReviewResponse();
  response.structuredDiff.hunks = [
    { header: "@@ broken @@", lines: [{ kind: "added", text: "x" }] },
  ];

  expect(() => decodeRepositoryFileReview(response)).toThrowError(
    /header must be a hunk header matching the unified diff grammar/,
  );
});

test("available contentにreasonがある応答を拒否する", () => {
  const response = createMinimalFileReviewResponse();
  response.newContent.reason = "binary";

  expect(() => decodeRepositoryFileReview(response)).toThrowError(
    /newContent must be available content with null metadata/,
  );
});

test("omitted structuredDiffにhunksがある応答を拒否する", () => {
  const response = createMinimalFileReviewResponse();
  response.structuredDiff = {
    state: "omitted",
    hunks: [{ header: "@@ -1 +1 @@", lines: [] }],
    reason: "binary",
  };

  expect(() => decodeRepositoryFileReview(response)).toThrowError(
    /structuredDiff\.hunks must be an empty array/,
  );
});
