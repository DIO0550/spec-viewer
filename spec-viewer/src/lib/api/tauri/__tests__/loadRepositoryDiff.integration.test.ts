import { invoke } from "@tauri-apps/api/core";
import { beforeEach, expect, test, vi } from "vitest";

import {
  LoadRepositoryDiffCommandError,
  loadRepositoryDiff,
} from "@/lib/api/tauri/loadRepositoryDiff";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

const invokeMock = vi.mocked(invoke);

import {
  createInvalidOverrideBaseResponse,
  createMinimalOverviewResponse,
  SAMPLE_SNAPSHOT_ID,
} from "./repositoryDiffTestFixtures";

beforeEach(() => {
  invokeMock.mockReset();
});

test("loadRepositoryDiffはworktreeIdをrequestとして渡す", async () => {
  invokeMock.mockResolvedValue(createMinimalOverviewResponse());

  await loadRepositoryDiff({ worktreeId: "/repo" });

  expect(invokeMock).toHaveBeenCalledOnce();
  expect(invokeMock).toHaveBeenCalledWith("load_repository_diff", {
    request: { worktreeId: "/repo" },
  });
});

test("loadRepositoryDiffはbaseOverrideをrequestへ載せる", async () => {
  invokeMock.mockResolvedValue(createMinimalOverviewResponse());

  await loadRepositoryDiff({
    worktreeId: "/repo",
    baseOverride: "refs/heads/develop",
  });

  expect(invokeMock).toHaveBeenCalledWith("load_repository_diff", {
    request: { worktreeId: "/repo", baseOverride: "refs/heads/develop" },
  });
});

test("loadRepositoryDiffは成功応答をdomainへdecodeする", async () => {
  invokeMock.mockResolvedValue(createMinimalOverviewResponse());

  const overview = await loadRepositoryDiff({ worktreeId: "/repo" });

  expect(overview.currentSnapshotId).toBe(SAMPLE_SNAPSHOT_ID);
  expect(overview.base.state).toBe("resolved");
});

test("base.state=invalidOverrideはthrowせず成功応答として返す", async () => {
  const response = createMinimalOverviewResponse();
  response.base = createInvalidOverrideBaseResponse();
  response.repositoryId = null;
  response.currentSnapshotId = null;
  invokeMock.mockResolvedValue(response);

  const overview = await loadRepositoryDiff({
    worktreeId: "/repo",
    baseOverride: "refs/heads/missing",
  });

  expect(overview.base).toMatchObject({
    state: "invalidOverride",
    overrideRef: "refs/heads/missing",
  });
});

test("rejectをcommand errorとしてthrowする", async () => {
  invokeMock.mockRejectedValue({
    code: "notRepository",
    message: "not a repository",
  });

  await expect(
    loadRepositoryDiff({ worktreeId: "/tmp" }),
  ).rejects.toMatchObject({
    command: "load_repository_diff",
    code: "notRepository",
    message: "not a repository",
  });
});

test("decode失敗はinvalidResponseとしてthrowする", async () => {
  const response = createMinimalOverviewResponse();
  response.base.state = "pending";
  invokeMock.mockResolvedValue(response);

  await expect(
    loadRepositoryDiff({ worktreeId: "/repo" }),
  ).rejects.toMatchObject({
    command: "load_repository_diff",
    code: "invalidResponse",
    raw: response,
  });
});

test("decoder以外の例外はcommand errorへ包まずそのまま再throwする", async () => {
  const failure = new RangeError("property access exploded");
  invokeMock.mockResolvedValue({
    ...createMinimalOverviewResponse(),
    get changed(): never {
      throw failure;
    },
  });

  await expect(loadRepositoryDiff({ worktreeId: "/repo" })).rejects.toBe(
    failure,
  );
});

test("LoadRepositoryDiffCommandErrorはcommand名を刻む", () => {
  expect(LoadRepositoryDiffCommandError.unknown("failed", null).command).toBe(
    "load_repository_diff",
  );
});
