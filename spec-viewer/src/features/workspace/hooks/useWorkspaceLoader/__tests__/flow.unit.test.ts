import { expect, test, vi } from "vitest";

import {
  isEntryGuarded,
  openDroppedWorkspacePath,
  openRecentWorkspacePath,
  openWorkspaceFromInput,
  openWorkspacePath,
} from "@/features/workspace/hooks/useWorkspaceLoader/flow";
import type { WorkspaceLoaderFlowIo } from "@/features/workspace/hooks/useWorkspaceLoader/types";
import { workspacePathFixture } from "@/features/workspace/testing/workspacePath";
import { ValidateWorkspaceDirectoryCommandError } from "@/shared/api/tauri/validateWorkspaceDirectory";

const invalidDroppedDirectoryMessage =
  "ワークスペースフォルダをドロップしてください。ファイルはワークスペースとして開けません。";
const missingSavedWorkspaceMessage =
  "ワークスペースが見つかりません。保存済み一覧から削除しました。";
const unsupportedSavedWorkspaceMessage =
  "対応していないワークスペースです。保存済み一覧から削除しました。";

const noGuards = { isWorkspaceOpening: false, isBrowsingWorkspace: false };

function createIo(
  overrides: Partial<WorkspaceLoaderFlowIo> = {},
): WorkspaceLoaderFlowIo {
  return {
    validate: vi.fn(async () => ({ isDirectory: true })),
    load: vi.fn(async () => true),
    ...overrides,
  };
}

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
} {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

test("drop成功でio.validate→io.loadがこの順に各1回呼ばれる", async () => {
  const order: string[] = [];
  const io: WorkspaceLoaderFlowIo = {
    validate: vi.fn(async () => {
      order.push("validate");
      return { isDirectory: true };
    }),
    load: vi.fn(async () => {
      order.push("load");
      return true;
    }),
  };

  await openDroppedWorkspacePath(workspacePathFixture("/drop"), noGuards, io);

  expect(order).toEqual(["validate", "load"]);
});

test.each([
  [
    "手入力",
    (io: WorkspaceLoaderFlowIo) => openWorkspaceFromInput("/path", io),
    false,
  ],
  [
    "browse合流コア",
    (io: WorkspaceLoaderFlowIo) =>
      openWorkspacePath(workspacePathFixture("/path"), io),
    false,
  ],
  [
    "drop",
    (io: WorkspaceLoaderFlowIo) =>
      openDroppedWorkspacePath(workspacePathFixture("/path"), noGuards, io),
    true,
  ],
  [
    "recent",
    (io: WorkspaceLoaderFlowIo) =>
      openRecentWorkspacePath(
        workspacePathFixture("/path"),
        noGuards,
        workspacePathFixture("/active"),
        io,
      ),
    true,
  ],
] as const)("preserveの入口差分（%s）", async (_label, invoke, expectedPreserve) => {
  const io = createIo();

  await invoke(io);

  expect(io.load).toHaveBeenCalledWith(
    workspacePathFixture("/path"),
    expectedPreserve,
  );
});

test("手入力: trim後のpathでloadされloadedを返す", async () => {
  const io = createIo();

  const outcome = await openWorkspaceFromInput("  /path  ", io);

  expect(outcome).toEqual({ type: "loaded" });
  expect(io.load).toHaveBeenCalledTimes(1);
  expect(io.load).toHaveBeenCalledWith(workspacePathFixture("/path"), false);
  expect(io.validate).not.toHaveBeenCalled();
});

test("手入力: file URLをcanonical pathへ変換してloadする", async () => {
  const io = createIo();

  const outcome = await openWorkspaceFromInput(
    "file:///workspace/spec%20viewer/",
    io,
  );

  expect(outcome).toEqual({ type: "loaded" });
  expect(io.load).toHaveBeenCalledWith(
    workspacePathFixture("/workspace/spec viewer"),
    false,
  );
});

test("手入力: 空白のみでemptyInputを返しio未呼び出し", async () => {
  const io = createIo();

  const outcome = await openWorkspaceFromInput("   ", io);

  expect(outcome).toEqual({ type: "emptyInput" });
  expect(io.validate).not.toHaveBeenCalled();
  expect(io.load).not.toHaveBeenCalled();
});

test("手入力: 不正なfile URLでtyped invalidInputを返しio未呼び出し", async () => {
  const io = createIo();

  const outcome = await openWorkspaceFromInput("file://%", io);

  expect(outcome).toEqual({
    type: "invalidInput",
    error: { reason: "invalidWorkspaceFileUrl" },
  });
  expect(io.validate).not.toHaveBeenCalled();
  expect(io.load).not.toHaveBeenCalled();
});

test("手入力: load失敗でloadFailedSilentlyを返す", async () => {
  const io = createIo({ load: vi.fn(async () => false) });

  const outcome = await openWorkspaceFromInput("/path", io);

  expect(outcome).toEqual({ type: "loadFailedSilently" });
});

test.each([
  [true, { type: "loaded" }],
  [false, { type: "loadFailedSilently" }],
] as const)("browse合流コア: load %s", async (loadResult, expected) => {
  const io = createIo({ load: vi.fn(async () => loadResult) });

  const outcome = await openWorkspacePath(workspacePathFixture("/path"), io);

  expect(outcome).toEqual(expected);
});

test("drop: validate通過でloaded", async () => {
  const io = createIo();

  const outcome = await openDroppedWorkspacePath(
    workspacePathFixture("/drop"),
    noGuards,
    io,
  );

  expect(outcome).toEqual({ type: "loaded" });
});

test("drop: 非ディレクトリでnotDirectoryを返しload未呼び出し", async () => {
  const io = createIo({
    validate: vi.fn(async () => ({ isDirectory: false })),
  });

  const outcome = await openDroppedWorkspacePath(
    workspacePathFixture("/drop"),
    noGuards,
    io,
  );

  expect(outcome).toEqual({
    type: "notDirectory",
    dropMessage: invalidDroppedDirectoryMessage,
  });
  expect(io.load).not.toHaveBeenCalled();
});

test("drop: validate例外でdropExceptionを返す", async () => {
  const failure = new Error("validate boom");
  const io = createIo({
    validate: vi.fn(async () => {
      throw failure;
    }),
  });

  const outcome = await openDroppedWorkspacePath(
    workspacePathFixture("/drop"),
    noGuards,
    io,
  );

  expect(outcome).toEqual({
    type: "dropException",
    dropMessage:
      ValidateWorkspaceDirectoryCommandError.fromUnknown(failure).message,
  });
});

test("drop: load失敗でloadFailedSilently", async () => {
  const io = createIo({ load: vi.fn(async () => false) });

  const outcome = await openDroppedWorkspacePath(
    workspacePathFixture("/drop"),
    noGuards,
    io,
  );

  expect(outcome).toEqual({ type: "loadFailedSilently" });
});

test.each([
  ["opening", { isWorkspaceOpening: true, isBrowsingWorkspace: false }],
  ["browsing", { isWorkspaceOpening: false, isBrowsingWorkspace: true }],
])("drop: ガード（%s）でskippedを返しio未呼び出し", async (_label, guards) => {
  const io = createIo();

  const outcome = await openDroppedWorkspacePath(
    workspacePathFixture("/drop"),
    guards,
    io,
  );

  expect(outcome).toEqual({ type: "skipped" });
  expect(io.validate).not.toHaveBeenCalled();
  expect(io.load).not.toHaveBeenCalled();
});

test("recent: 復元成功でloaded", async () => {
  const io = createIo();

  const outcome = await openRecentWorkspacePath(
    workspacePathFixture("/recent"),
    noGuards,
    workspacePathFixture("/active"),
    io,
  );

  expect(outcome).toEqual({ type: "loaded" });
});

test("recent: ディレクトリ不在でrecentMissingを返しload未呼び出し", async () => {
  const io = createIo({
    validate: vi.fn(async () => ({ isDirectory: false })),
  });

  const outcome = await openRecentWorkspacePath(
    workspacePathFixture("/recent"),
    noGuards,
    workspacePathFixture("/active"),
    io,
  );

  expect(outcome).toEqual({
    type: "recentMissing",
    removePath: workspacePathFixture("/recent"),
    dialogMessage: missingSavedWorkspaceMessage,
    rollbackInput: workspacePathFixture("/active"),
  });
  expect(io.load).not.toHaveBeenCalled();
});

test("recent: load失敗でrecentUnsupported", async () => {
  const io = createIo({ load: vi.fn(async () => false) });

  const outcome = await openRecentWorkspacePath(
    workspacePathFixture("/recent"),
    noGuards,
    workspacePathFixture("/active"),
    io,
  );

  expect(outcome).toEqual({
    type: "recentUnsupported",
    removePath: workspacePathFixture("/recent"),
    dialogMessage: unsupportedSavedWorkspaceMessage,
    rollbackInput: workspacePathFixture("/active"),
  });
});

test("recent: validate例外でrecentExceptionを返す（文言連結）", async () => {
  const failure = new Error("validate boom");
  const io = createIo({
    validate: vi.fn(async () => {
      throw failure;
    }),
  });

  const outcome = await openRecentWorkspacePath(
    workspacePathFixture("/recent"),
    noGuards,
    workspacePathFixture("/active"),
    io,
  );

  expect(outcome).toEqual({
    type: "recentException",
    removePath: workspacePathFixture("/recent"),
    dialogMessage: `${missingSavedWorkspaceMessage} ${ValidateWorkspaceDirectoryCommandError.fromUnknown(failure).message}`,
    rollbackInput: workspacePathFixture("/active"),
  });
});

test("recent: activeWorkspaceRootがnullならrollbackInputは空文字", async () => {
  const io = createIo({
    validate: vi.fn(async () => ({ isDirectory: false })),
  });

  const outcome = await openRecentWorkspacePath(
    workspacePathFixture("/recent"),
    noGuards,
    null,
    io,
  );

  expect(outcome).toMatchObject({ rollbackInput: "" });
});

test.each([
  ["opening", { isWorkspaceOpening: true, isBrowsingWorkspace: false }],
  ["browsing", { isWorkspaceOpening: false, isBrowsingWorkspace: true }],
])("recent: ガード（%s）でskippedを返しio未呼び出し", async (_label, guards) => {
  const io = createIo();

  const outcome = await openRecentWorkspacePath(
    workspacePathFixture("/recent"),
    guards,
    workspacePathFixture("/active"),
    io,
  );

  expect(outcome).toEqual({ type: "skipped" });
  expect(io.validate).not.toHaveBeenCalled();
});

test.each([
  ["opening", { isWorkspaceOpening: true, isBrowsingWorkspace: false }, true],
  ["browsing", { isWorkspaceOpening: false, isBrowsingWorkspace: true }, true],
  ["両方", { isWorkspaceOpening: true, isBrowsingWorkspace: true }, true],
  [
    "どちらもなし",
    { isWorkspaceOpening: false, isBrowsingWorkspace: false },
    false,
  ],
])("isEntryGuarded（%s）", (_label, guards, expected) => {
  expect(isEntryGuarded(guards)).toBe(expected);
});

test("競合: recentのvalidate pending中でもdropはskippedにならず並行実行される", async () => {
  const validateDeferred = deferred<{ isDirectory: boolean }>();
  const io: WorkspaceLoaderFlowIo = {
    validate: vi.fn(() => validateDeferred.promise),
    load: vi.fn(async () => true),
  };

  const recentPromise = openRecentWorkspacePath(
    workspacePathFixture("/recent"),
    noGuards,
    workspacePathFixture("/active"),
    io,
  );
  const dropPromise = openDroppedWorkspacePath(
    workspacePathFixture("/drop"),
    noGuards,
    io,
  );

  expect(io.validate).toHaveBeenCalledTimes(2);

  validateDeferred.resolve({ isDirectory: true });

  const [recentOutcome, dropOutcome] = await Promise.all([
    recentPromise,
    dropPromise,
  ]);

  expect(recentOutcome).toEqual({ type: "loaded" });
  expect(dropOutcome).toEqual({ type: "loaded" });
});
