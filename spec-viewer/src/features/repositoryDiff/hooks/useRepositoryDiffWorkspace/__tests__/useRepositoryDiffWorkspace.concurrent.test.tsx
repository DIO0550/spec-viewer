import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import {
  type RepositoryDiffWorkspaceApi,
  type UseRepositoryDiffWorkspaceOptions,
  useRepositoryDiffWorkspace,
} from "@/features/repositoryDiff/hooks/useRepositoryDiffWorkspace";
import type {
  IgnoredPage,
  RepositoryDiffOverview,
  RepositoryFileReview,
} from "@/features/repositoryDiff/domain/repositoryDiff";

const snapshotOne = "rs1_" + "a".repeat(64);
const snapshotTwo = "rs1_" + "b".repeat(64);
const nodeId = "in1_" + "c".repeat(64);
const resolvedBase: RepositoryDiffOverview["base"] = {
  state: "resolved",
  source: "main",
  branchRef: "refs/heads/main",
  mergeBaseSha: "d".repeat(40),
  headSha: "e".repeat(40),
};

function createOverview(snapshotId: string): RepositoryDiffOverview {
  return {
    repositoryId: "rr1_" + "f".repeat(64),
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

test("deferred ignored directoryはsnapshotとcursor identityでloadingからreadyになる", async () => {
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
