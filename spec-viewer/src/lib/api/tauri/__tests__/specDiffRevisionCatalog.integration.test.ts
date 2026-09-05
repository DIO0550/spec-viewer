import { invoke } from "@tauri-apps/api/core";
import { expect, test, vi } from "vitest";

import { listSpecDiffRevisions } from "@/lib/api/tauri/listSpecDiffRevisions";
import { listSpecFileCommitHistory } from "@/lib/api/tauri/listSpecFileCommitHistory";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
const invokeMock = vi.mocked(invoke);
const sha = "a".repeat(40);

test("revision catalogはtagged responseをdecodeしてcanonical idを作る", async () => {
  invokeMock.mockReset();
  invokeMock.mockResolvedValue({
    options: [
      {
        revision: { kind: "head" },
        label: "HEAD",
        resolvedCommitSha: sha,
      },
      {
        revision: { kind: "localBranch", name: "refs/heads/main" },
        label: "main",
        resolvedCommitSha: sha,
      },
    ],
  });

  await expect(
    listSpecDiffRevisions({ workspacePath: "/workspace" }),
  ).resolves.toEqual([
    {
      id: "head",
      revision: { kind: "head" },
      label: "HEAD",
      resolvedCommitSha: sha,
    },
    {
      id: "localBranch:refs/heads/main",
      revision: { kind: "localBranch", name: "refs/heads/main" },
      label: "main",
      resolvedCommitSha: sha,
    },
  ]);
});

test("revision catalogはcanonicalでないrefをinvalidResponseにする", async () => {
  const raw = {
    options: [
      {
        revision: { kind: "localBranch", name: "main" },
        label: "main",
        resolvedCommitSha: sha,
      },
    ],
  };
  invokeMock.mockReset();
  invokeMock.mockResolvedValue(raw);

  await expect(
    listSpecDiffRevisions({ workspacePath: "/workspace" }),
  ).rejects.toMatchObject({ code: "invalidResponse", raw });
});

test("file historyはitemsとtruncatedをdecodeしてidentity requestを渡す", async () => {
  const response = {
    items: [{ sha, committedAt: "2026-08-04T00:00:00Z", message: "change" }],
    truncated: true,
  };
  invokeMock.mockReset();
  invokeMock.mockResolvedValue(response);
  const request = {
    workspacePath: "/workspace",
    specId: "080-issue-169",
    fileKey: "tasks",
    path: ".plugin-workspace/.specs/080-issue-169/tasks.md",
  };

  await expect(listSpecFileCommitHistory(request)).resolves.toEqual(response);
  expect(invokeMock).toHaveBeenCalledWith("list_spec_file_commit_history", {
    request,
  });
});

test("file historyは不正truncatedをinvalidResponseにする", async () => {
  const raw = { items: [], truncated: "no" };
  invokeMock.mockReset();
  invokeMock.mockResolvedValue(raw);

  await expect(
    listSpecFileCommitHistory({
      workspacePath: "/workspace",
      specId: "080-issue-169",
      fileKey: "tasks",
      path: "tasks.md",
    }),
  ).rejects.toMatchObject({ code: "invalidResponse", raw });
});
