import { invoke } from "@tauri-apps/api/core";
import { beforeEach, expect, test, vi } from "vitest";

import { loadRepositoryFile } from "@/lib/api/tauri/loadRepositoryFile";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

const invokeMock = vi.mocked(invoke);

import {
  createMinimalFileReviewResponse,
  SAMPLE_SNAPSHOT_ID,
} from "./repositoryDiffTestFixtures";

const request = {
  worktreeId: "/repo",
  currentSnapshotId: SAMPLE_SNAPSHOT_ID,
  path: "src/main.ts",
} as const;

beforeEach(() => {
  invokeMock.mockReset();
});

test("loadRepositoryFileはworktree・snapshot・pathをrequestとして渡す", async () => {
  invokeMock.mockResolvedValue(createMinimalFileReviewResponse());

  await loadRepositoryFile(request);

  expect(invokeMock).toHaveBeenCalledOnce();
  expect(invokeMock).toHaveBeenCalledWith("load_repository_file", { request });
});

test("成功応答をFileReviewとして返す", async () => {
  const response = createMinimalFileReviewResponse();
  response.structuredDiff.hunks = [
    { header: "@@ -0,0 +1 @@", lines: [{ kind: "added", text: "# Tasks" }] },
  ];
  invokeMock.mockResolvedValue(response);

  const review = await loadRepositoryFile(request);

  expect(review.file.change).toBe("added");
  expect(review.structuredDiff.hunks[0]?.lines[0]).toEqual({
    kind: "added",
    text: "# Tasks",
    oldLineNumber: null,
    newLineNumber: 1,
  });
});

test("binaryファイルのomitted structuredDiffを返す", async () => {
  const response = createMinimalFileReviewResponse();
  response.file.contentClassification = "binary";
  response.structuredDiff = { state: "omitted", hunks: [], reason: "binary" };
  invokeMock.mockResolvedValue(response);

  const review = await loadRepositoryFile(request);

  expect(review.structuredDiff).toEqual({
    state: "omitted",
    hunks: [],
    reason: "binary",
  });
});

test.each([
  "permissionDenied",
  "entryChangedDuringRead",
  "invalidInput",
])("reject code=%sをcommand errorとしてthrowする", async (code) => {
  invokeMock.mockRejectedValue({ code, message: `${code} rejected` });

  await expect(loadRepositoryFile(request)).rejects.toMatchObject({
    command: "load_repository_file",
    code,
    message: `${code} rejected`,
  });
});

test("decode失敗はinvalidResponseとしてthrowする", async () => {
  const response = createMinimalFileReviewResponse();
  response.file.change = "unknownChange";
  invokeMock.mockResolvedValue(response);

  await expect(loadRepositoryFile(request)).rejects.toMatchObject({
    command: "load_repository_file",
    code: "invalidResponse",
    raw: response,
  });
});
