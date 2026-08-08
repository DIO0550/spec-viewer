import { invoke } from "@tauri-apps/api/core";
import { beforeEach, expect, test, vi } from "vitest";

import { traverseRepositoryIgnored } from "@/lib/api/tauri/traverseRepositoryIgnored";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

const invokeMock = vi.mocked(invoke);

import {
  createFileTreeNodeFixture,
  createMinimalIgnoredPageResponse,
  SAMPLE_NODE_ID,
  SAMPLE_SNAPSHOT_ID,
} from "./repositoryDiffTestFixtures";

const baseRequest = {
  worktreeId: "/repo",
  currentSnapshotId: SAMPLE_SNAPSHOT_ID,
  nodeId: SAMPLE_NODE_ID,
} as const;

beforeEach(() => {
  invokeMock.mockReset();
});

test("初回ページをcursorなしで要求する", async () => {
  invokeMock.mockResolvedValue(createMinimalIgnoredPageResponse());

  await traverseRepositoryIgnored(baseRequest);

  expect(invokeMock).toHaveBeenCalledWith("traverse_repository_ignored", {
    request: baseRequest,
  });
});

test("2ページ目をnextCursor付きで要求する", async () => {
  invokeMock.mockResolvedValue(createMinimalIgnoredPageResponse());

  await traverseRepositoryIgnored({ ...baseRequest, cursor: "ic1_offset_200" });

  expect(invokeMock).toHaveBeenCalledWith("traverse_repository_ignored", {
    request: { ...baseRequest, cursor: "ic1_offset_200" },
  });
});

test("nodeIdを加工せず不透明stringとして送る", async () => {
  invokeMock.mockResolvedValue(createMinimalIgnoredPageResponse());

  await traverseRepositoryIgnored({ ...baseRequest, nodeId: "opaque-node" });

  expect(invokeMock).toHaveBeenCalledWith("traverse_repository_ignored", {
    request: { ...baseRequest, nodeId: "opaque-node" },
  });
});

test("entriesを持つページをdecodeして返す", async () => {
  const response = createMinimalIgnoredPageResponse();
  response.entries = [createFileTreeNodeFixture()];
  response.nextCursor = "ic1_offset_200";
  invokeMock.mockResolvedValue(response);

  const page = await traverseRepositoryIgnored(baseRequest);

  expect(page.entries).toHaveLength(1);
  expect(page.nextCursor).toBe("ic1_offset_200");
});

test("空ページと終端nextCursorを返す", async () => {
  invokeMock.mockResolvedValue(createMinimalIgnoredPageResponse());

  const page = await traverseRepositoryIgnored(baseRequest);

  expect(page.entries).toEqual([]);
  expect(page.nextCursor).toBeNull();
});

test.each([
  "staleSnapshot",
  "staleCursor",
  "invalidCursor",
])("stale系のreject code=%sを正規化してthrowする", async (code) => {
  invokeMock.mockRejectedValue({ code, message: `${code} rejected` });

  await expect(traverseRepositoryIgnored(baseRequest)).rejects.toMatchObject({
    command: "traverse_repository_ignored",
    code,
  });
});

test("decode失敗はinvalidResponseとしてthrowする", async () => {
  invokeMock.mockResolvedValue({ nodeId: 42, entries: [], nextCursor: null });

  await expect(traverseRepositoryIgnored(baseRequest)).rejects.toMatchObject({
    command: "traverse_repository_ignored",
    code: "invalidResponse",
  });
});
