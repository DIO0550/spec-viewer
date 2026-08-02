import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import { createDiffViewerFixture } from "@/features/diff/components/DiffViewer/testFixtures";
import {
  type SpecDiffWorkspaceApi,
  type UseSpecDiffWorkspaceOptions,
  useSpecDiffWorkspace,
} from "@/features/diff/hooks/useSpecDiffWorkspace";
import type { ListChangedSpecFilesCommandResponse } from "@/lib/api/tauri";

const unchangedResponse: ListChangedSpecFilesCommandResponse = {
  currentSnapshotId: "snapshot-1",
  files: [],
};

const changedResponse: ListChangedSpecFilesCommandResponse = {
  currentSnapshotId: "snapshot-2",
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

function renderHook(options: UseSpecDiffWorkspaceOptions): Readonly<{
  current: () => ReturnType<typeof useSpecDiffWorkspace>;
  rerender: (next: UseSpecDiffWorkspaceOptions) => void;
  unmount: () => void;
}> {
  const root = createRoot(document.createElement("div"));
  const result = {
    current: undefined as unknown as ReturnType<typeof useSpecDiffWorkspace>,
  };

  function TestComponent(
    props: Readonly<{ options: UseSpecDiffWorkspaceOptions }>,
  ): null {
    result.current = useSpecDiffWorkspace(props.options);
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

test("repository外のoverview失敗はunavailableへ分類する", async () => {
  const api = createApi({
    listChangedSpecFiles: vi.fn(async () => {
      throw { code: "notRepository", message: "Git repositoryではありません" };
    }),
  });
  const hook = renderHook({
    workspacePath: "/workspace",
    selection: { specId: null, fileKey: null },
    api,
  });

  await flush();

  expect(hook.current().state).toEqual(
    expect.objectContaining({
      status: "unavailable",
      reason: "Git repositoryではありません",
    }),
  );
  hook.unmount();
});

test("stale detailは同じrefresh cycleでoverviewから一度だけ復旧する", async () => {
  const api = createApi({
    listChangedSpecFiles: vi
      .fn<SpecDiffWorkspaceApi["listChangedSpecFiles"]>()
      .mockResolvedValueOnce(changedResponse)
      .mockResolvedValueOnce({
        ...changedResponse,
        currentSnapshotId: "snapshot-3",
      }),
    getSpecFileDiff: vi
      .fn<SpecDiffWorkspaceApi["getSpecFileDiff"]>()
      .mockRejectedValueOnce({
        code: "staleSnapshot",
        message: "snapshot changed",
      })
      .mockResolvedValueOnce(createDiffViewerFixture({ fileKey: "impl" })),
  });
  const hook = renderHook({
    workspacePath: "/workspace",
    selection: { specId: "079-issue-168", fileKey: "impl" },
    api,
  });

  await flush();
  await flush();

  expect(api.listChangedSpecFiles).toHaveBeenCalledTimes(2);
  expect(api.getSpecFileDiff).toHaveBeenCalledTimes(2);
  expect(hook.current().state).toMatchObject({
    status: "ready",
    overview: { currentSnapshotId: "snapshot-3" },
    detail: { status: "ready" },
  });
  hook.unmount();
});

test("refresh連打は同じdrain Promiseを共有して末尾を一度だけ再取得する", async () => {
  const firstOverview = createDeferred<ListChangedSpecFilesCommandResponse>();
  const api = createApi({
    listChangedSpecFiles: vi
      .fn<SpecDiffWorkspaceApi["listChangedSpecFiles"]>()
      .mockImplementationOnce(async () => firstOverview.promise)
      .mockResolvedValueOnce(unchangedResponse),
  });
  const hook = renderHook({
    workspacePath: "/workspace",
    selection: { specId: null, fileKey: null },
    api,
  });

  const firstRefresh = hook.current().refresh();
  const secondRefresh = hook.current().refresh();
  expect(firstRefresh).toBe(secondRefresh);

  firstOverview.resolve(unchangedResponse);
  await act(async () => {
    await Promise.all([firstRefresh, secondRefresh]);
  });

  expect(api.listChangedSpecFiles).toHaveBeenCalledTimes(2);
  expect(hook.current().state.status).toBe("ready");
  hook.unmount();
});

test("workspace切替前のoverview応答を破棄して切替先を読み直す", async () => {
  const oldOverview = createDeferred<ListChangedSpecFilesCommandResponse>();
  const api = createApi({
    listChangedSpecFiles: vi
      .fn<SpecDiffWorkspaceApi["listChangedSpecFiles"]>()
      .mockImplementationOnce(async () => oldOverview.promise)
      .mockResolvedValueOnce(unchangedResponse),
  });
  const initialOptions = {
    workspacePath: "/workspace-old",
    selection: { specId: null, fileKey: null },
    api,
  };
  const hook = renderHook(initialOptions);

  hook.rerender({ ...initialOptions, workspacePath: "/workspace-new" });
  oldOverview.resolve(changedResponse);
  await flush();
  await flush();

  expect(api.listChangedSpecFiles).toHaveBeenNthCalledWith(2, {
    workspacePath: "/workspace-new",
  });
  expect(hook.current().state).toMatchObject({
    status: "ready",
    workspacePath: "/workspace-new",
  });
  hook.unmount();
});
