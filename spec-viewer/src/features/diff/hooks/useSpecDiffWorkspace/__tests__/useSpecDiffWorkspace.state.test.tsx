import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import { createDiffViewerFixture } from "@/features/diff/components/DiffViewer/testFixtures";
import {
  toSpecChangeOverview,
  type SpecDiffWorkspaceApi,
  type UseSpecDiffWorkspaceOptions,
  useSpecDiffWorkspace,
} from "@/features/diff/hooks/useSpecDiffWorkspace";
import type { ListChangedSpecFilesCommandResponse } from "@/lib/api/tauri";

type HookHandle = Readonly<{
  current: () => ReturnType<typeof useSpecDiffWorkspace>;
  rerender: (options: UseSpecDiffWorkspaceOptions) => void;
  unmount: () => void;
}>;

type Deferred<T> = Readonly<{
  promise: Promise<T>;
  resolve: (value: T) => void;
}>;

const unchangedResponse: ListChangedSpecFilesCommandResponse = {
  currentSnapshotId: "snapshot-1",
  resolvedBaseSha: "a".repeat(40),
  files: [],
};

const changedResponse: ListChangedSpecFilesCommandResponse = {
  currentSnapshotId: "snapshot-2",
  resolvedBaseSha: "a".repeat(40),
  diffReviewIdentity: {
    repositoryId: `rr1_${"b".repeat(64)}`,
    worktreeId: `rw1_${"c".repeat(64)}`,
    baseSha: "a".repeat(40),
    currentSnapshotId: `rs1_${"d".repeat(64)}`,
  },
  files: [
    {
      specId: "079-issue-168",
      fileKey: "impl",
      targetPath:
        ".plugin-workspace/.specs/079-issue-168/implementation-plan.md",
      oldPath: "implementation-plan.md",
      newPath: "implementation-plan.md",
      change: "modified",
    },
  ],
};

function createApi(
  overrides: Partial<SpecDiffWorkspaceApi> = {},
): SpecDiffWorkspaceApi {
  return {
    listChangedSpecFiles: vi.fn(async () => unchangedResponse),
    getSpecFileDiff: vi.fn(async () => createDiffViewerFixture()),
    ...overrides,
  };
}

function createDeferred<T>(): Deferred<T> {
  let resolveValue: (value: T) => void = () => undefined;
  const promise = new Promise<T>((resolve) => {
    resolveValue = resolve;
  });
  return { promise, resolve: resolveValue };
}

function renderHook(options: UseSpecDiffWorkspaceOptions): HookHandle {
  const container = document.createElement("div");
  const root = createRoot(container);
  const result = {
    current: undefined as unknown as ReturnType<typeof useSpecDiffWorkspace>,
  };

  function TestComponent(
    props: Readonly<{ options: UseSpecDiffWorkspaceOptions }>,
  ): null {
    result.current = useSpecDiffWorkspace(props.options);
    return null;
  }

  act(() => {
    root.render(<TestComponent options={options} />);
  });

  return {
    current: () => result.current,
    rerender: (nextOptions) => {
      act(() => {
        root.render(<TestComponent options={nextOptions} />);
      });
    },
    unmount: () => {
      act(() => {
        root.unmount();
      });
    },
  };
}

async function flush(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
  });
}

test("API responseをpureなSpecChangeOverviewへ切り離して変換する", () => {
  const overview = toSpecChangeOverview(changedResponse);

  expect(overview).toEqual(changedResponse);
  expect(overview).not.toBe(changedResponse);
  expect(overview.files[0]).not.toBe(changedResponse.files[0]);
});

test("revision catalogのHEAD候補はresolved commit SHAを保持する", async () => {
  const resolvedCommitSha = "b".repeat(40);
  const api = createApi({
    listSpecDiffRevisions: vi.fn(async () => [
      {
        id: "head",
        revision: { kind: "head" } as const,
        label: "HEAD",
        resolvedCommitSha,
      },
    ]),
  });
  const hook = renderHook({
    workspacePath: "/workspace",
    selection: { specId: null, fileKey: null },
    api,
  });

  await flush();

  expect(hook.current().revisionOptions).toEqual({
    status: "ready",
    value: [
      {
        id: "head",
        revision: { kind: "head" },
        label: "HEAD",
        resolvedCommitSha,
      },
    ],
  });
  hook.unmount();
});

test("workspace選択時に変更一覧を読み込みunchangedになる", async () => {
  const api = createApi();
  const hook = renderHook({
    workspacePath: "/workspace",
    selection: { specId: "079-issue-168", fileKey: "impl" },
    api,
  });

  await flush();

  expect(api.listChangedSpecFiles).toHaveBeenCalledExactlyOnceWith({
    workspacePath: "/workspace",
  });
  expect(api.getSpecFileDiff).not.toHaveBeenCalled();
  expect(hook.current().state).toMatchObject({
    status: "ready",
    detail: { status: "unchanged" },
  });
  hook.unmount();
});

test("変更対象の選択では同じsnapshotの詳細を読み込む", async () => {
  const api = createApi({
    listChangedSpecFiles: vi.fn(async () => changedResponse),
  });
  const hook = renderHook({
    workspacePath: "/workspace",
    selection: { specId: "079-issue-168", fileKey: "impl" },
    api,
  });

  await flush();

  expect(api.getSpecFileDiff).toHaveBeenCalledExactlyOnceWith({
    workspacePath: "/workspace",
    currentSnapshotId: "snapshot-2",
    resolvedBaseSha: "a".repeat(40),
    specId: "079-issue-168",
    fileKey: "impl",
    path: ".plugin-workspace/.specs/079-issue-168/implementation-plan.md",
  });
  expect(hook.current().state).toMatchObject({
    status: "ready",
    detail: { status: "ready" },
  });
  hook.unmount();
});

test("選択変更はoverviewを再取得せず新しい詳細だけを読む", async () => {
  const response: ListChangedSpecFilesCommandResponse = {
    ...changedResponse,
    files: [
      ...changedResponse.files,
      {
        ...changedResponse.files[0]!,
        fileKey: "tasks",
        targetPath: ".plugin-workspace/.specs/079-issue-168/tasks.md",
      },
    ],
  };
  const api = createApi({
    listChangedSpecFiles: vi.fn(async () => response),
  });
  const initialOptions = {
    workspacePath: "/workspace",
    selection: { specId: "079-issue-168", fileKey: "impl" as const },
    api,
  };
  const hook = renderHook(initialOptions);
  await flush();

  hook.rerender({
    ...initialOptions,
    selection: { specId: "079-issue-168", fileKey: "tasks" },
  });
  await flush();

  expect(api.listChangedSpecFiles).toHaveBeenCalledTimes(1);
  expect(api.getSpecFileDiff).toHaveBeenCalledTimes(2);
  expect(api.getSpecFileDiff).toHaveBeenLastCalledWith(
    expect.objectContaining({ fileKey: "tasks" }),
  );
  hook.unmount();
});

test("古いdetail応答は後続選択へ反映しない", async () => {
  const firstDetail =
    createDeferred<
      Awaited<ReturnType<SpecDiffWorkspaceApi["getSpecFileDiff"]>>
    >();
  const api = createApi({
    listChangedSpecFiles: vi.fn(async () => ({
      ...changedResponse,
      files: [
        ...changedResponse.files,
        {
          ...changedResponse.files[0]!,
          fileKey: "tasks",
          targetPath: ".plugin-workspace/.specs/079-issue-168/tasks.md",
        },
      ],
    })),
    getSpecFileDiff: vi
      .fn<SpecDiffWorkspaceApi["getSpecFileDiff"]>()
      .mockImplementationOnce(async () => firstDetail.promise)
      .mockResolvedValueOnce(createDiffViewerFixture({ fileKey: "tasks" })),
  });
  const initialOptions = {
    workspacePath: "/workspace",
    selection: { specId: "079-issue-168", fileKey: "impl" as const },
    api,
  };
  const hook = renderHook(initialOptions);
  await flush();

  hook.rerender({
    ...initialOptions,
    selection: { specId: "079-issue-168", fileKey: "tasks" },
  });
  await flush();
  firstDetail.resolve(createDiffViewerFixture({ fileKey: "impl" }));
  await flush();

  expect(hook.current().state).toMatchObject({
    status: "ready",
    detail: { status: "ready", value: { identity: { path: "tasks" } } },
  });
  hook.unmount();
});

test("comparison成功時だけoverviewとdetailを同じresolved baseでcommitする", async () => {
  const selected = {
    kind: "localBranch",
    name: "refs/heads/previous",
  } as const;
  const selectedResponse = {
    ...changedResponse,
    currentSnapshotId: "snapshot-selected",
    resolvedBaseSha: "b".repeat(40),
  };
  const api = createApi({
    listChangedSpecFiles: vi
      .fn<SpecDiffWorkspaceApi["listChangedSpecFiles"]>()
      .mockResolvedValueOnce(changedResponse)
      .mockResolvedValueOnce(selectedResponse),
  });
  const hook = renderHook({
    workspacePath: "/workspace",
    selection: { specId: "079-issue-168", fileKey: "impl" },
    api,
  });
  await flush();

  let succeeded = false;
  await act(async () => {
    succeeded = await hook.current().selectComparison(selected);
  });

  expect(succeeded).toBe(true);
  expect(hook.current().comparison).toEqual(selected);
  expect(hook.current().state).toMatchObject({
    status: "ready",
    overview: {
      currentSnapshotId: "snapshot-selected",
      resolvedBaseSha: "b".repeat(40),
    },
    detail: { status: "ready" },
  });
  expect(api.getSpecFileDiff).toHaveBeenLastCalledWith(
    expect.objectContaining({
      currentSnapshotId: "snapshot-selected",
      resolvedBaseSha: "b".repeat(40),
    }),
  );
  hook.unmount();
});

test("comparison detail失敗時は直前diffと選択を保持してerrorだけ公開する", async () => {
  const selected = { kind: "tag", name: "refs/tags/missing" } as const;
  const api = createApi({
    listChangedSpecFiles: vi.fn(async () => changedResponse),
    getSpecFileDiff: vi
      .fn<SpecDiffWorkspaceApi["getSpecFileDiff"]>()
      .mockResolvedValueOnce(createDiffViewerFixture())
      .mockRejectedValueOnce({
        code: "revisionNotFound",
        message: "deleted ref",
      }),
  });
  const hook = renderHook({
    workspacePath: "/workspace",
    selection: { specId: "079-issue-168", fileKey: "impl" },
    api,
  });
  await flush();
  const previousState = hook.current().state;

  let succeeded = true;
  await act(async () => {
    succeeded = await hook.current().selectComparison(selected);
  });

  expect(succeeded).toBe(false);
  expect(hook.current().comparison).toEqual({ kind: "head" });
  expect(hook.current().state).toBe(previousState);
  expect(hook.current().comparisonOperation).toEqual({
    status: "failed",
    requested: selected,
    message: "deleted ref",
  });
  hook.unmount();
});
