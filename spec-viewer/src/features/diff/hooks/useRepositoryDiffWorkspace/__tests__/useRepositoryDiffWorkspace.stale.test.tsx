import { expect, test, vi } from "vitest";

import type { RepositoryDiffOverview } from "@/features/diff/domain/repositoryDiff";
import { createDeferred, flush } from "@/lib/test/renderHook";

import {
  createCommands,
  createOverview,
  renderWorkspace,
  SNAPSHOT_A,
  WORKTREE_A,
  WORKTREE_B,
} from "./fixtures";

test("worktree高速切替で古い応答がstateに入らない", async () => {
  const first = createDeferred<RepositoryDiffOverview>();
  const second = createDeferred<RepositoryDiffOverview>();
  const responses = [first.promise, second.promise];
  const commands = createCommands({
    loadOverview: vi.fn(async () => responses.shift() ?? createOverview()),
  });

  const handle = renderWorkspace({ worktreeId: WORKTREE_A, commands });
  handle.rerender({ worktreeId: WORKTREE_B, commands });
  second.resolve(createOverview());
  await flush();
  first.resolve({ ...createOverview(), warnings: ["stale-a"] });
  await flush();

  const state = handle.current().state;

  expect(state.status).toBe("loaded");
  expect(state.status === "loaded" && state.worktreeId).toBe(WORKTREE_B);
  expect(state.status === "loaded" && state.overview.warnings).toEqual([]);
  handle.unmount();
});

test("古い応答がresolveしてもstate参照が変化しない", async () => {
  const first = createDeferred<RepositoryDiffOverview>();
  const responses = [first.promise];
  const commands = createCommands({
    loadOverview: vi.fn(async () => responses.shift() ?? createOverview()),
  });

  const handle = renderWorkspace({ worktreeId: WORKTREE_A, commands });
  handle.rerender({ worktreeId: WORKTREE_B, commands });
  await flush();
  const settled = handle.current().state;

  first.resolve({ ...createOverview(), warnings: ["stale-a"] });
  await flush();

  expect(handle.current().state).toBe(settled);
  handle.unmount();
});

test("stale failureでも自動再取得しない", async () => {
  const commands = createCommands({
    loadOverview: vi.fn(async () => {
      throw { code: "staleSnapshot", message: "snapshot expired" };
    }),
  });

  const handle = renderWorkspace({ worktreeId: WORKTREE_A, commands });
  await flush();
  await flush(260);

  const state = handle.current().state;

  expect(state.status).toBe("error");
  expect(state.status === "error" && state.failure.kind).toBe("stale");
  expect(commands.loadOverview).toHaveBeenCalledTimes(1);
  handle.unmount();
});

test("unmount後にresolveした応答でstateを更新しない", async () => {
  const deferred = createDeferred<RepositoryDiffOverview>();
  const commands = createCommands({
    loadOverview: vi.fn(async () => deferred.promise),
  });

  const handle = renderWorkspace({ worktreeId: WORKTREE_A, commands });
  const beforeUnmount = handle.current().state;
  handle.unmount();
  deferred.resolve(createOverview());
  await flush();

  expect(handle.current().state).toBe(beforeUnmount);
  expect(beforeUnmount.status).toBe("loading");
});

test("同じpropsでの再renderでは重複取得しない", async () => {
  const commands = createCommands();
  const handle = renderWorkspace({ worktreeId: WORKTREE_A, commands });
  await flush();
  handle.rerender({ worktreeId: WORKTREE_A, commands });
  await flush();
  handle.rerender({ worktreeId: WORKTREE_A, commands });
  await flush();

  expect(commands.loadOverview).toHaveBeenCalledTimes(1);
  handle.unmount();
});

test("worktreeをnullへ戻すとidleへ戻り取得も走らない", async () => {
  const commands = createCommands();
  const handle = renderWorkspace({ worktreeId: WORKTREE_A, commands });
  await flush();
  handle.rerender({ worktreeId: null, commands });
  await flush();

  expect(handle.current().state.status).toBe("idle");
  expect(commands.loadOverview).toHaveBeenCalledTimes(1);
  handle.unmount();
});

test("snapshotが変わる再取得の後も新しいsnapshotで file review を要求する", async () => {
  const commands = createCommands();
  const handle = renderWorkspace({ worktreeId: WORKTREE_A, commands });
  await flush();
  handle.current().selectFile("src/main.ts");
  await flush();

  expect(commands.loadFile).toHaveBeenCalledWith({
    worktreeId: WORKTREE_A,
    currentSnapshotId: SNAPSHOT_A,
    path: "src/main.ts",
  });
  handle.unmount();
});
