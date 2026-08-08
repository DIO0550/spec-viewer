import { invoke } from "@tauri-apps/api/core";
import { expect, test, vi } from "vitest";

import { flush } from "@/lib/test/renderHook";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

const invokeMock = vi.mocked(invoke);

import {
  createCommands,
  createInvalidOverrideOverview,
  emptyPage,
  NODE_A,
  renderWorkspace,
  review,
  SNAPSHOT_A,
  WORKTREE_A,
} from "./fixtures";

const DEBOUNCE_WAIT_MS = 260;

test("worktree指定でoverviewを1回取得する", async () => {
  const commands = createCommands();
  const handle = renderWorkspace({ worktreeId: WORKTREE_A, commands });
  await flush();

  expect(commands.loadOverview).toHaveBeenCalledOnce();
  expect(commands.loadOverview).toHaveBeenCalledWith({
    worktreeId: WORKTREE_A,
    baseOverride: null,
  });
  expect(handle.current().state.status).toBe("loaded");
  handle.unmount();
});

test("worktreeIdがnullならoverviewを取得しない", async () => {
  const commands = createCommands();
  const handle = renderWorkspace({ worktreeId: null, commands });
  await flush();

  expect(commands.loadOverview).not.toHaveBeenCalled();
  expect(handle.current().state.status).toBe("idle");
  handle.unmount();
});

test("失敗時はerror状態へ遷移しfailure.causeが元のerrorを保持する", async () => {
  const error = { code: "notRepository", message: "not a repository" };
  const commands = createCommands({
    loadOverview: vi.fn(async () => {
      throw error;
    }),
  });
  const handle = renderWorkspace({ worktreeId: WORKTREE_A, commands });
  await flush();

  const state = handle.current().state;

  expect(state.status).toBe("error");
  expect(state.status === "error" && state.failure).toMatchObject({
    kind: "unavailable",
    code: "notRepository",
  });
  expect(state.status === "error" && state.failure.cause).toBe(error);
  handle.unmount();
});

test.each([
  { name: "省略", options: {} },
  { name: "明示null", options: { baseOverride: null } },
])("baseOverrideを$nameしても応答がstateへ反映される", async ({ options }) => {
  const commands = createCommands();
  const handle = renderWorkspace({
    worktreeId: WORKTREE_A,
    commands,
    ...options,
  });
  await flush();

  expect(handle.current().state.status).toBe("loaded");
  handle.unmount();
});

test("baseOverride変更で再取得が走る", async () => {
  const commands = createCommands();
  const handle = renderWorkspace({ worktreeId: WORKTREE_A, commands });
  await flush();
  handle.rerender({
    worktreeId: WORKTREE_A,
    commands,
    baseOverride: "refs/heads/develop",
  });
  await flush();

  expect(commands.loadOverview).toHaveBeenCalledTimes(2);
  expect(commands.loadOverview).toHaveBeenLastCalledWith({
    worktreeId: WORKTREE_A,
    baseOverride: "refs/heads/develop",
  });
  handle.unmount();
});

test("selectFileはloadFileをsnapshot付きで呼ぶ", async () => {
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
  const state = handle.current().state;
  expect(state.status === "loaded" && state.fileReview).toEqual({
    state: "loaded",
    path: "src/main.ts",
    review,
  });
  handle.unmount();
});

test("expandIgnoredDirectoryはtraverseIgnoredをnodeIdとcursor付きで呼ぶ", async () => {
  const commands = createCommands();
  const handle = renderWorkspace({ worktreeId: WORKTREE_A, commands });
  await flush();
  handle.current().expandIgnoredDirectory(NODE_A, null);
  await flush();

  expect(commands.traverseIgnored).toHaveBeenCalledWith({
    worktreeId: WORKTREE_A,
    currentSnapshotId: SNAPSHOT_A,
    nodeId: NODE_A,
    cursor: null,
  });
  const state = handle.current().state;
  expect(state.status === "loaded" && state.expansions.get(NODE_A)).toEqual({
    state: "expanded",
    entries: emptyPage.entries,
    nextCursor: null,
  });
  handle.unmount();
});

test.each([
  ["selectFile", "loadFile"],
  ["expandIgnoredDirectory", "traverseIgnored"],
] as const)("snapshot不可のloaded状態で%sはno-opになる", async (_callback, command) => {
  const commands = createCommands({
    loadOverview: vi.fn(async () => createInvalidOverrideOverview()),
  });
  const handle = renderWorkspace({
    worktreeId: WORKTREE_A,
    commands,
    baseOverride: "refs/heads/missing",
  });
  await flush();
  const before = handle.current().state;

  handle.current().selectFile("src/main.ts");
  handle.current().expandIgnoredDirectory(NODE_A, null);
  await flush();

  expect(commands[command]).not.toHaveBeenCalled();
  expect(handle.current().state).toBe(before);
  handle.unmount();
});

test("notifyExternalChangeの連打が1回の再取得へ合流する", async () => {
  const commands = createCommands();
  const handle = renderWorkspace({ worktreeId: WORKTREE_A, commands });
  await flush();

  handle.current().notifyExternalChange();
  handle.current().notifyExternalChange();
  handle.current().notifyExternalChange();
  await flush(DEBOUNCE_WAIT_MS);

  expect(commands.loadOverview).toHaveBeenCalledTimes(2);
  handle.unmount();
});

test("refresh()はdebounce窓を経由して再取得を1回だけ追加する", async () => {
  const commands = createCommands();
  const handle = renderWorkspace({ worktreeId: WORKTREE_A, commands });
  await flush();

  handle.current().refresh();
  await flush(DEBOUNCE_WAIT_MS);

  expect(commands.loadOverview).toHaveBeenCalledTimes(2);
  handle.unmount();
});

test("commands未指定なら本物のrepositoryCommandsを既定値として使う", async () => {
  invokeMock.mockReset();
  invokeMock.mockRejectedValue({ code: "io", message: "io failure" });

  const handle = renderWorkspace({ worktreeId: WORKTREE_A });
  await flush();

  expect(invokeMock).toHaveBeenCalledWith("load_repository_diff", {
    request: { worktreeId: WORKTREE_A, baseOverride: null },
  });
  expect(handle.current().state.status).toBe("error");
  handle.unmount();
});
