import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import type {
  IgnoredPage,
  RepositoryDiffOverview,
  RepositoryFileReview,
} from "@/features/repositoryDiff/domain/repositoryDiff";
import {
  type RepositoryDiffWorkspaceApi,
  type UseRepositoryDiffWorkspaceOptions,
  useRepositoryDiffWorkspace,
} from "@/features/repositoryDiff/hooks/useRepositoryDiffWorkspace";

const snapshotOne = `rs1_${"a".repeat(64)}`;
const snapshotTwo = `rs1_${"b".repeat(64)}`;
const nodeId = `in1_${"c".repeat(64)}`;
const nodeIdTwo = `in1_${"d".repeat(64)}`;
const nodeIdThree = `in1_${"e".repeat(64)}`;
const resolvedBase: RepositoryDiffOverview["base"] = {
  state: "resolved",
  source: "main",
  branchRef: "refs/heads/main",
  mergeBaseSha: "d".repeat(40),
  headSha: "e".repeat(40),
};

function createOverview(snapshotId: string): RepositoryDiffOverview {
  return {
    repositoryId: `rr1_${"f".repeat(64)}`,
    base: resolvedBase,
    currentSnapshotId: snapshotId,
    changed: [],
    changedTree: [],
    allRoot: [],
    allPaths: [],
    ignoredDirectories: [],
    warnings: [],
  };
}

const review: RepositoryFileReview = {
  file: {
    oldPath: "src/file.ts",
    newPath: "src/file.ts",
    change: "modified",
    entryKind: "regular",
    contentClassification: "text",
    similarity: null,
    oldMode: null,
    newMode: null,
  },
  oldContent: {
    state: "available",
    text: "old",
    reason: null,
    byteLength: null,
  },
  newContent: {
    state: "available",
    text: "new",
    reason: null,
    byteLength: null,
  },
  patch: { state: "available", text: "patch", reason: null, byteLength: null },
  structuredDiff: { state: "available", hunks: [], reason: null },
  submodule: null,
};
const page: IgnoredPage = { nodeId, entries: [], nextCursor: null };

function createPageFor(targetNodeId: string): IgnoredPage {
  return { nodeId: targetNodeId, entries: [], nextCursor: null };
}

function createApi(
  overrides: Partial<RepositoryDiffWorkspaceApi> = {},
): RepositoryDiffWorkspaceApi {
  return {
    loadRepositoryDiff: vi.fn(async () => createOverview(snapshotOne)),
    loadRepositoryFile: vi.fn(async () => review),
    traverseRepositoryIgnored: vi.fn(async () => page),
    ...overrides,
  };
}

function createDeferred<T>(): Readonly<{
  promise: Promise<T>;
  resolve: (value: T) => void;
}> {
  let resolveValue: (value: T) => void = () => undefined;
  const promise = new Promise<T>((resolve) => {
    resolveValue = resolve;
  });
  return { promise, resolve: resolveValue };
}

function renderHook(options: UseRepositoryDiffWorkspaceOptions): Readonly<{
  current: () => ReturnType<typeof useRepositoryDiffWorkspace>;
  rerender: (next: UseRepositoryDiffWorkspaceOptions) => void;
  unmount: () => void;
}> {
  const root = createRoot(document.createElement("div"));
  const result = {
    current: undefined as unknown as ReturnType<
      typeof useRepositoryDiffWorkspace
    >,
  };
  function TestComponent(
    props: Readonly<{ options: UseRepositoryDiffWorkspaceOptions }>,
  ): null {
    result.current = useRepositoryDiffWorkspace(props.options);
    return null;
  }
  act(() => root.render(<TestComponent options={options} />));
  return {
    current: () => result.current,
    rerender: (next) => {
      act(() => root.render(<TestComponent options={next} />));
    },
    unmount: () => {
      act(() => root.unmount());
    },
  };
}

async function flush(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

const options = (
  api: RepositoryDiffWorkspaceApi,
): UseRepositoryDiffWorkspaceOptions => ({
  workspacePath: "/workspace",
  worktreeId: "/workspace",
  baseOverride: null,
  selection: null,
  api,
});

test("worktree切替前のoverview responseを破棄して切替先だけを表示する", async () => {
  const oldOverview = createDeferred<RepositoryDiffOverview>();
  const api = createApi({
    loadRepositoryDiff: vi
      .fn<RepositoryDiffWorkspaceApi["loadRepositoryDiff"]>()
      .mockImplementationOnce(async () => oldOverview.promise)
      .mockResolvedValueOnce(createOverview(snapshotTwo)),
  });
  const initial = {
    ...options(api),
    workspacePath: "/old",
    worktreeId: "/old",
  };
  const hook = renderHook(initial);
  hook.rerender({ ...initial, workspacePath: "/new", worktreeId: "/new" });
  oldOverview.resolve(createOverview(snapshotOne));
  await flush();
  await flush();
  expect(api.loadRepositoryDiff).toHaveBeenNthCalledWith(2, {
    worktreeId: "/new",
  });
  expect(hook.current().state.request?.workspacePath).toBe("/new");
  expect(hook.current().state.overview?.currentSnapshotId).toBe(snapshotTwo);
  hook.unmount();
});

test("invalidate後の旧overview responseを表示状態へ反映しない", async () => {
  const oldOverview = createDeferred<RepositoryDiffOverview>();
  const api = createApi({
    loadRepositoryDiff: vi
      .fn<RepositoryDiffWorkspaceApi["loadRepositoryDiff"]>()
      .mockImplementationOnce(async () => oldOverview.promise),
  });
  const hook = renderHook(options(api));
  act(() => {
    hook.current().invalidate();
  });
  oldOverview.resolve(createOverview(snapshotOne));
  await flush();
  expect(hook.current().state.status).toBe("idle");
  expect(hook.current().state.overview).toBeNull();
  hook.unmount();
});

test("base override切替前のoverview responseを破棄する", async () => {
  const oldOverview = createDeferred<RepositoryDiffOverview>();
  const api = createApi({
    loadRepositoryDiff: vi
      .fn<RepositoryDiffWorkspaceApi["loadRepositoryDiff"]>()
      .mockImplementationOnce(async () => oldOverview.promise)
      .mockResolvedValueOnce(createOverview(snapshotTwo)),
  });
  const initial = options(api);
  const hook = renderHook(initial);
  hook.rerender({ ...initial, baseOverride: "refs/heads/release" });
  oldOverview.resolve(createOverview(snapshotOne));
  await flush();
  await flush();
  expect(api.loadRepositoryDiff).toHaveBeenNthCalledWith(2, {
    worktreeId: "/workspace",
    baseOverride: "refs/heads/release",
  });
  expect(hook.current().state.request?.baseOverride).toBe("refs/heads/release");
  hook.unmount();
});

test("selection変更はoverviewを再取得せず同じsnapshotのdetailだけを取得する", async () => {
  const api = createApi();
  const hook = renderHook(options(api));
  await flush();
  let selected = false;
  await act(async () => {
    selected = await hook.current().selectPath("src/file.ts");
  });
  expect(selected).toBe(true);
  expect(api.loadRepositoryDiff).toHaveBeenCalledTimes(1);
  expect(api.loadRepositoryFile).toHaveBeenCalledWith({
    worktreeId: "/workspace",
    currentSnapshotId: snapshotOne,
    path: "src/file.ts",
  });
  expect(hook.current().state.detail.status).toBe("ready");
  hook.unmount();
});

test("stale detailはoverviewを一度だけ再取得して新snapshotのdetailを採用する", async () => {
  const api = createApi({
    loadRepositoryDiff: vi
      .fn<RepositoryDiffWorkspaceApi["loadRepositoryDiff"]>()
      .mockResolvedValueOnce(createOverview(snapshotOne))
      .mockResolvedValueOnce(createOverview(snapshotTwo)),
    loadRepositoryFile: vi
      .fn<RepositoryDiffWorkspaceApi["loadRepositoryFile"]>()
      .mockRejectedValueOnce({ code: "staleSnapshot", message: "stale" })
      .mockResolvedValueOnce(review),
  });
  const hook = renderHook({
    ...options(api),
    selection: {
      worktreeId: "/workspace",
      snapshotId: snapshotOne,
      path: "src/file.ts",
    },
  });
  await flush();
  await flush();
  expect(api.loadRepositoryDiff).toHaveBeenCalledTimes(2);
  expect(api.loadRepositoryFile).toHaveBeenCalledTimes(2);
  expect(hook.current().state.overview?.currentSnapshotId).toBe(snapshotTwo);
  expect(hook.current().state.detail.status).toBe("ready");
  hook.unmount();
});

test("rapid refreshは同じdrainを共有し末尾だけを再取得する", async () => {
  const firstOverview = createDeferred<RepositoryDiffOverview>();
  const api = createApi({
    loadRepositoryDiff: vi
      .fn<RepositoryDiffWorkspaceApi["loadRepositoryDiff"]>()
      .mockImplementationOnce(async () => firstOverview.promise)
      .mockResolvedValueOnce(createOverview(snapshotTwo)),
  });
  const hook = renderHook(options(api));
  const firstRefresh = hook.current().refresh();
  const secondRefresh = hook.current().refresh();
  expect(firstRefresh).toBe(secondRefresh);
  firstOverview.resolve(createOverview(snapshotOne));
  await act(async () => {
    await Promise.all([firstRefresh, secondRefresh]);
  });
  expect(api.loadRepositoryDiff).toHaveBeenCalledTimes(2);
  expect(hook.current().state.overview?.currentSnapshotId).toBe(snapshotTwo);
  hook.unmount();
});

test("selectBaseOverrideは指定refでoverviewを再取得する", async () => {
  const api = createApi();
  const hook = renderHook(options(api));
  await flush();
  let selected = false;
  await act(async () => {
    selected = await hook.current().selectBaseOverride("refs/heads/release");
  });
  expect(selected).toBe(true);
  expect(api.loadRepositoryDiff).toHaveBeenLastCalledWith({
    worktreeId: "/workspace",
    baseOverride: "refs/heads/release",
  });
  expect(hook.current().state.request?.baseOverride).toBe("refs/heads/release");
  hook.unmount();
});

test("[R199-TREE-004] deferred ignored directoryはsnapshotとcursor identityでloadingからreadyになる", async () => {
  const deferredPage = createDeferred<IgnoredPage>();
  const api = createApi({
    traverseRepositoryIgnored: vi
      .fn<RepositoryDiffWorkspaceApi["traverseRepositoryIgnored"]>()
      .mockImplementationOnce(async () => deferredPage.promise),
  });
  const hook = renderHook(options(api));
  await flush();
  const loading = hook.current().loadIgnoredChildren(nodeId);
  await flush();
  expect(hook.current().state.ignoredPageStates[nodeId]?.status).toBe(
    "loading",
  );
  deferredPage.resolve(page);
  await loading;
  await flush();
  expect(api.traverseRepositoryIgnored).toHaveBeenCalledWith({
    worktreeId: "/workspace",
    currentSnapshotId: snapshotOne,
    nodeId,
  });
  expect(hook.current().state.ignoredPages[nodeId]).toEqual(page);
  expect(hook.current().state.ignoredPageStates[nodeId]?.status).toBe("ready");
  hook.unmount();
});

test("path-only selectionはoverviewのcurrentSnapshotIdを注入してdetailを取得する", async () => {
  const api = createApi();
  const hook = renderHook({
    ...options(api),
    selection: { worktreeId: "/workspace", path: "src/file.ts" },
  });

  await flush();
  await flush();

  expect(api.loadRepositoryFile).toHaveBeenCalledWith({
    worktreeId: "/workspace",
    currentSnapshotId: snapshotOne,
    path: "src/file.ts",
  });
  expect(hook.current().selection).toEqual({
    worktreeId: "/workspace",
    snapshotId: snapshotOne,
    path: "src/file.ts",
  });
  hook.unmount();
});

test("同一ignored page identityの重複要求をcoalesceする", async () => {
  const deferredPage = createDeferred<IgnoredPage>();
  const api = createApi({
    traverseRepositoryIgnored: vi
      .fn<RepositoryDiffWorkspaceApi["traverseRepositoryIgnored"]>()
      .mockImplementationOnce(async () => deferredPage.promise),
  });
  const hook = renderHook(options(api));
  await flush();

  const first = hook.current().loadIgnoredChildren(nodeId);
  const second = hook.current().loadIgnoredChildren(nodeId);

  expect(first).toBe(second);
  await flush();
  expect(api.traverseRepositoryIgnored).toHaveBeenCalledTimes(1);
  deferredPage.resolve(page);
  await expect(first).resolves.toBe(true);
  hook.unmount();
});

test("同一ignored nodeの異なるcursorは直列化する", async () => {
  const firstPage = createDeferred<IgnoredPage>();
  const secondPage = createDeferred<IgnoredPage>();
  const api = createApi({
    traverseRepositoryIgnored: vi
      .fn<RepositoryDiffWorkspaceApi["traverseRepositoryIgnored"]>()
      .mockImplementationOnce(async () => firstPage.promise)
      .mockImplementationOnce(async () => secondPage.promise),
  });
  const hook = renderHook(options(api));
  await flush();

  const first = hook.current().loadIgnoredChildren(nodeId);
  const second = hook.current().loadIgnoredChildren(nodeId, "cursor-2");
  await flush();
  expect(api.traverseRepositoryIgnored).toHaveBeenCalledTimes(1);
  firstPage.resolve(page);
  await expect(first).resolves.toBe(true);
  await flush();
  expect(api.traverseRepositoryIgnored).toHaveBeenNthCalledWith(2, {
    worktreeId: "/workspace",
    currentSnapshotId: snapshotOne,
    nodeId,
    cursor: "cursor-2",
  });
  secondPage.resolve(page);
  await expect(second).resolves.toBe(true);
  hook.unmount();
});

test("異なるignored nodeは最大2件までin-flightでFIFOに排出する", async () => {
  const deferredPages: Array<{
    promise: Promise<IgnoredPage>;
    resolve: (value: IgnoredPage) => void;
  }> = [];
  const api = createApi({
    traverseRepositoryIgnored: vi
      .fn<RepositoryDiffWorkspaceApi["traverseRepositoryIgnored"]>()
      .mockImplementation(async () => {
        const deferredPage = createDeferred<IgnoredPage>();
        deferredPages.push(deferredPage);
        return deferredPage.promise;
      }),
  });
  const hook = renderHook(options(api));
  await flush();

  const first = hook.current().loadIgnoredChildren(nodeId);
  const second = hook.current().loadIgnoredChildren(nodeIdTwo);
  const third = hook.current().loadIgnoredChildren(nodeIdThree);
  await flush();

  expect(deferredPages).toHaveLength(2);
  deferredPages[0]?.resolve(createPageFor(nodeId));
  deferredPages[1]?.resolve(createPageFor(nodeIdTwo));
  await Promise.all([first, second]);
  await flush();
  expect(deferredPages).toHaveLength(3);
  deferredPages[2]?.resolve(createPageFor(nodeIdThree));
  await expect(third).resolves.toBe(true);
  hook.unmount();
});

test("ignored page pending queueは32件を上限にし、超過要求を拒否する", async () => {
  const deferredPages: Array<{
    promise: Promise<IgnoredPage>;
    resolve: (value: IgnoredPage) => void;
  }> = [];
  const api = createApi({
    traverseRepositoryIgnored: vi
      .fn<RepositoryDiffWorkspaceApi["traverseRepositoryIgnored"]>()
      .mockImplementation(async () => {
        const deferredPage = createDeferred<IgnoredPage>();
        deferredPages.push(deferredPage);
        return deferredPage.promise;
      }),
  });
  const hook = renderHook(options(api));
  await flush();

  const requests = Array.from({ length: 35 }, (_, index) =>
    hook.current().loadIgnoredChildren(`queued-node-${String(index)}`),
  );
  await flush();

  expect(deferredPages).toHaveLength(2);
  await expect(requests[34]).resolves.toBe(false);
  deferredPages[0]?.resolve(createPageFor(nodeId));
  deferredPages[1]?.resolve(createPageFor(nodeIdTwo));
  await Promise.all([requests[0], requests[1]]);
  hook.unmount();
});

test("overview refresh中に進行中のignored page 2件を破棄し、新snapshotだけを採用する", async () => {
  const nextOverview = createDeferred<RepositoryDiffOverview>();
  const firstPage = createDeferred<IgnoredPage>();
  const secondPage = createDeferred<IgnoredPage>();
  const api = createApi({
    loadRepositoryDiff: vi
      .fn<RepositoryDiffWorkspaceApi["loadRepositoryDiff"]>()
      .mockResolvedValueOnce(createOverview(snapshotOne))
      .mockImplementationOnce(async () => nextOverview.promise),
    traverseRepositoryIgnored: vi
      .fn<RepositoryDiffWorkspaceApi["traverseRepositoryIgnored"]>()
      .mockImplementationOnce(async () => firstPage.promise)
      .mockImplementationOnce(async () => secondPage.promise),
  });
  const hook = renderHook(options(api));
  await flush();

  const first = hook.current().loadIgnoredChildren(nodeId);
  const second = hook.current().loadIgnoredChildren(nodeIdTwo);
  await flush();
  expect(api.traverseRepositoryIgnored).toHaveBeenCalledTimes(2);

  const refresh = hook.current().refresh();
  firstPage.resolve(createPageFor(nodeId));
  secondPage.resolve(createPageFor(nodeIdTwo));
  await expect(first).resolves.toBe(false);
  await expect(second).resolves.toBe(false);
  expect(hook.current().state.ignoredPages).toEqual({});

  nextOverview.resolve(createOverview(snapshotTwo));
  await expect(refresh).resolves.toBe(true);
  await flush();
  expect(hook.current().state.overview?.currentSnapshotId).toBe(snapshotTwo);
  expect(hook.current().state.ignoredPages).toEqual({});
  hook.unmount();
});
