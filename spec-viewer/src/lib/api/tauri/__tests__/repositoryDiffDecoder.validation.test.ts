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
  createNeedsSelectionBaseResponse,
} from "./repositoryDiffTestFixtures";

test("未知のbase.stateを拒否する", () => {
  const response = createMinimalOverviewResponse();
  response.base.state = "pending";

  expect(() => decodeRepositoryDiffOverview(response)).toThrowError(
    /base\.state must be one of resolved\|needsSelection\|invalidOverride/,
  );
});

test.each([
  { name: "branchRefがnull", mutate: "branchRef" },
  { name: "mergeBaseShaがnull", mutate: "mergeBaseSha" },
  { name: "headShaがnull", mutate: "headSha" },
] as const)("resolvedで$nameの応答を拒否する", ({ mutate }) => {
  const response = createMinimalOverviewResponse();
  response.base[mutate] = null;

  expect(() => decodeRepositoryDiffOverview(response)).toThrowError(
    InvalidDiffResponseError,
  );
});

test("resolvedでreasonが非nullの応答を拒否する", () => {
  const response = createMinimalOverviewResponse();
  response.base.reason = "notFound";

  expect(() => decodeRepositoryDiffOverview(response)).toThrowError(
    /base\.reason must be null/,
  );
});

test.each([
  { name: "reasonがnull", reason: null },
  { name: "未知のreason", reason: "somethingElse" },
])("needsSelectionで$nameの応答を拒否する", ({ reason }) => {
  const response = createMinimalOverviewResponse();
  response.base = createNeedsSelectionBaseResponse();
  response.base.reason = reason;

  expect(() => decodeRepositoryDiffOverview(response)).toThrowError(
    /base\.reason must be one of/,
  );
});

test("invalidOverrideでoverrideRefがnullの応答を拒否する", () => {
  const response = createMinimalOverviewResponse();
  response.base = createInvalidOverrideBaseResponse();
  response.base.overrideRef = null;

  expect(() => decodeRepositoryDiffOverview(response)).toThrowError(
    /base\.overrideRef must be a string/,
  );
});

test("未知のchildren.stateを拒否する", () => {
  const response = createMinimalOverviewResponse();
  response.allRoot = [
    {
      ...createFileTreeNodeFixture(),
      children: { state: "pending", items: [] },
    },
  ];

  expect(() => decodeRepositoryDiffOverview(response)).toThrowError(
    /children\.state must be one of loaded\|deferred/,
  );
});

test("deferredでnodeIdが欠けた応答を拒否する", () => {
  const response = createMinimalOverviewResponse();
  response.allRoot = [
    {
      ...createFileTreeNodeFixture(),
      children: { state: "deferred" } as unknown as {
        state: string;
        nodeId: string;
      },
    },
  ];

  expect(() => decodeRepositoryDiffOverview(response)).toThrowError(
    /children\.nodeId must be a string/,
  );
});

test.each([
  "changed",
  "changedTree",
  "allRoot",
  "all",
] as const)("%sが非配列の応答を拒否する", (field) => {
  const response = {
    ...createMinimalOverviewResponse(),
    [field]: "not-an-array",
  };

  expect(() => decodeRepositoryDiffOverview(response)).toThrowError(
    new RegExp(`${field} must be an array`),
  );
});

test("ignoredが非booleanの応答を拒否する", () => {
  const response = createMinimalOverviewResponse();
  response.allRoot = [
    { ...createFileTreeNodeFixture(), ignored: "yes" as unknown as boolean },
  ];

  expect(() => decodeRepositoryDiffOverview(response)).toThrowError(
    /ignored must be a boolean/,
  );
});

test.each([
  { name: "null", value: null },
  { name: "文字列", value: "response" },
  { name: "配列", value: [] },
])("response自体が非オブジェクトの$nameを拒否する", ({ value }) => {
  expect(() => decodeRepositoryDiffOverview(value)).toThrowError(
    /response must be an object/,
  );
  expect(() => decodeRepositoryFileReview(value)).toThrowError(
    /response must be an object/,
  );
});

test.each([
  {
    name: "addedでnewPathがnull",
    change: "added",
    oldPath: null,
    newPath: null,
  },
  {
    name: "deletedでoldPathがnull",
    change: "deleted",
    oldPath: null,
    newPath: null,
  },
  {
    name: "renamedでoldPathとnewPathが同一",
    change: "renamed",
    oldPath: "src/a.ts",
    newPath: "src/a.ts",
  },
] as const)("path invariant違反（$name）を拒否する", ({
  change,
  oldPath,
  newPath,
}) => {
  const response = createMinimalOverviewResponse();
  response.changed = [
    { ...createFileChangeFixture(), change, oldPath, newPath },
  ];

  expect(() => decodeRepositoryDiffOverview(response)).toThrowError(
    InvalidDiffResponseError,
  );
});

test("検証失敗時のerror.rawは完全な応答を保持する", () => {
  const response = createMinimalOverviewResponse();
  response.base.state = "pending";

  const error = (() => {
    try {
      decodeRepositoryDiffOverview(response);
      return null;
    } catch (thrown) {
      return thrown;
    }
  })();

  expect(error).toBeInstanceOf(InvalidDiffResponseError);
  expect((error as InvalidDiffResponseError).raw).toBe(response);
});

test("file reviewの検証失敗でもraw payloadを保持する", () => {
  const response = createMinimalFileReviewResponse();
  response.file.change = "unknownChange";

  const error = (() => {
    try {
      decodeRepositoryFileReview(response);
      return null;
    } catch (thrown) {
      return thrown;
    }
  })();

  expect((error as InvalidDiffResponseError).raw).toBe(response);
});
