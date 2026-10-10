import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { useSpecs } from "@/features/specs/hooks/useSpecsV2";
import type {
  ArchiveSpecResponse,
  SpecBundle,
  SpecTree,
} from "@/features/specs/types/spec";
import type { SpecCommands } from "@/features/specs/application/specCommands";

const actEnvironment = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
actEnvironment.IS_REACT_ACT_ENVIRONMENT = true;

const commands = vi.hoisted(() => ({
  listSpecs: vi.fn<SpecCommands["listSpecs"]>(),
  loadSpecBundle: vi.fn<SpecCommands["loadSpecBundle"]>(),
  readSpecFile: vi.fn<SpecCommands["readSpecFile"]>(),
  archiveSpec: vi.fn<SpecCommands["archiveSpec"]>(),
}));

const tree: SpecTree = {
  specs: [
    {
      id: "spec-1",
      label: "Spec 1",
      kind: "spec",
      sourceGroupId: "primary",
      relativeId: "spec-1",
      presentDocumentCount: 2,
      descendantSpecCount: 0,
      progress: "inProgress",
      files: [
        {
          key: "impl",
          label: "Implementation",
          fileName: "implementation-plan.md",
          status: "present",
        },
      ],
      children: [],
    },
  ],
};

const bundle: SpecBundle = {
  specId: "spec-1",
  progress: "inProgress",
  artifacts: [
    {
      identity: { kind: "standard", fileKey: "impl" },
      fileKey: "impl",
      fileName: "implementation-plan.md",
      label: "Implementation",
      format: "markdown",
      progress: "completed",
      path: ".plugin-workspace/.specs/spec-1/implementation-plan.md",
      contents: "# Plan",
      blocks: [],
      error: null,
    },
    {
      identity: { kind: "directMarkdown", fileName: "Notes.md" },
      fileKey: null,
      fileName: "Notes.md",
      label: "Notes",
      format: "markdown",
      progress: "unknown",
      path: ".plugin-workspace/.specs/spec-1/Notes.md",
      contents: null,
      blocks: [],
      error: { code: "markdownRead", message: "Could not read artifact." },
    },
  ],
};

type HookResult = Readonly<{
  current: ReturnType<typeof useSpecs>;
  unmount: () => void;
  rerender: (workspacePath: string) => void;
}>;

const cleanups: (() => void)[] = [];

afterEach(() => {
  cleanups.splice(0).forEach((cleanup) => cleanup());
});

function renderSpecs(): HookResult {
  const container = document.createElement("div");
  const root = createRoot(container);
  const result = {
    current: undefined as unknown as ReturnType<typeof useSpecs>,
  };

  function TestComponent({ workspacePath }: { workspacePath: string }): null {
    result.current = useSpecs({
      commands: commands,
      workspacePath,
      onSelectionChange,
    });
    return null;
  }

  const rerender = (workspacePath: string) => {
    act(() => root.render(<TestComponent workspacePath={workspacePath} />));
  };
  const unmount = () => act(() => root.unmount());
  cleanups.push(unmount);
  rerender("/workspace/a");
  return {
    get current() {
      return result.current;
    },
    unmount,
    rerender,
  };
}

async function flushLoads(): Promise<void> {
  await act(async () => {
    for (let index = 0; index < 6; index += 1) {
      await Promise.resolve();
    }
  });
}

const onSelectionChange = vi.fn();

beforeEach(() => {
  onSelectionChange.mockReset();
  commands.listSpecs.mockReset();
  commands.loadSpecBundle.mockReset();
  commands.readSpecFile.mockReset();
  commands.archiveSpec.mockReset();
  commands.listSpecs.mockResolvedValue(tree);
  commands.loadSpecBundle.mockImplementation(async ({ specId }) =>
    specId === "archived-1" ? archivedBundle : bundle,
  );
});

const response: ArchiveSpecResponse = {
  archivedSpecId: "spec-1",
  archivePath: "/workspace/a/archive/spec-1",
  sourceGroupId: "primary",
  destinationNodeId: "archive/spec-1",
};
const archivedTree: SpecTree = {
  specs: [
    { ...tree.specs[0]!, id: "archived-1", relativeId: "archive/spec-1" },
  ],
};

const archivedBundle: SpecBundle = {
  ...bundle,
  specId: "archived-1",
  artifacts: [
    {
      ...bundle.artifacts[0]!,
      path: ".plugin-workspace/.specs/archive/spec-1/implementation-plan.md",
      contents: "# Archived plan",
    },
  ],
};

function expectArchivedDocument(result: HookResult): void {
  expect(commands.loadSpecBundle).toHaveBeenLastCalledWith({
    workspacePath: "/workspace/a",
    specId: "archived-1",
  });
  expect(result.current.state.bundleState.bundle?.specId).toBe("archived-1");
  expect(result.current.state.documentState.status).toBe("ready");
  expect(result.current.selectors.selectedArtifact?.path).toBe(
    archivedBundle.artifacts[0]!.path,
  );
  expect(result.current.selectors.selectedArtifact?.contents).toBe(
    "# Archived plan",
  );
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

test("アーカイブ失敗は文書を保持し、再試行成功でエラーと処理中状態を解除する", async () => {
  commands.archiveSpec.mockRejectedValueOnce({
    code: "specArchive",
    message: "移動失敗",
  });
  const result = renderSpecs();
  await flushLoads();
  const originalSelection = result.current.state.selection;

  await act(async () => {
    expect(await result.current.actions.archiveSpec("spec-1")).toBe(false);
  });
  expect(result.current.state.archiveFailure?.specId).toBe("spec-1");
  expect(result.current.state.archiveSpecError?.message).toBe("移動失敗");
  expect(result.current.state.selection).toEqual(originalSelection);
  expect(result.current.selectors.selectedArtifact?.contents).toBe("# Plan");
  expect(result.current.state.archivingSpecId).toBeNull();
  expect(result.current.state.isLoading).toBe(false);
  expect(commands.listSpecs).toHaveBeenCalledOnce();

  commands.archiveSpec.mockResolvedValueOnce(response);
  commands.listSpecs.mockResolvedValueOnce(archivedTree);
  await act(async () => {
    expect(await result.current.actions.retryArchiveSpec()).toBe(true);
  });
  expect(commands.archiveSpec).toHaveBeenNthCalledWith(2, {
    workspacePath: "/workspace/a",
    specId: "spec-1",
  });
  expectArchivedDocument(result);
  expect(result.current.state.archiveFailure).toBeNull();
  expect(result.current.state.archiveSpecError).toBeNull();
  expect(result.current.state.archiveReveal).toEqual({
    status: "success",
    workspacePath: "/workspace/a",
    response,
  });
  expect(result.current.state.archivingSpecId).toBeNull();
  expect(result.current.state.isLoading).toBe(false);
  await act(async () => {
    expect(await result.current.actions.retryArchiveSpec()).toBe(false);
  });
  expect(commands.archiveSpec).toHaveBeenCalledTimes(2);
});

test("アーカイブ後のツリー再読込失敗は移動を再実行せず更新で回復する", async () => {
  const result = renderSpecs();
  await flushLoads();
  commands.archiveSpec.mockResolvedValueOnce(response);
  commands.listSpecs.mockRejectedValueOnce({
    code: "specTreeScan",
    message: "一覧取得失敗",
  });
  await act(async () => {
    expect(await result.current.actions.archiveSpec("spec-1")).toBe(false);
  });
  expect(result.current.state.specTreeState.status).toBe("error");
  expect(result.current.state.selection.specId).toBeNull();
  expect(result.current.state.bundleState.status).toBe("idle");
  expect(result.current.state.archiveFailure).toBeNull();
  expect(result.current.state.archiveReveal).toBeNull();
  expect(result.current.state.archivingSpecId).toBeNull();
  expect(result.current.state.isLoading).toBe(false);
  expect(commands.loadSpecBundle).toHaveBeenCalledOnce();

  commands.listSpecs.mockResolvedValueOnce(archivedTree);
  await act(async () => {
    expect(await result.current.actions.retryArchiveSpec()).toBe(false);
    expect(await result.current.actions.refreshArchiveReveal()).toBe(true);
  });
  expect(result.current.state.specTreeState.status).toBe("ready");
  expect(result.current.state.selection.specId).toBe("archived-1");
  expectArchivedDocument(result);
  expect(commands.archiveSpec).toHaveBeenCalledOnce();
});

test("移動先が一覧にない場合は警告を保持し、更新で解除して移動を繰り返さない", async () => {
  const result = renderSpecs();
  await flushLoads();
  commands.archiveSpec.mockResolvedValueOnce(response);
  await act(async () => {
    expect(await result.current.actions.archiveSpec("spec-1")).toBe(true);
  });
  expect(result.current.state.archiveReveal).toEqual({
    status: "missing",
    workspacePath: "/workspace/a",
    response,
  });
  commands.listSpecs.mockResolvedValueOnce(archivedTree);
  await act(async () => {
    expect(await result.current.actions.refreshArchiveReveal()).toBe(true);
  });
  expect(result.current.state.archiveReveal).toBeNull();
  expect(result.current.state.selection.specId).toBe("archived-1");
  expectArchivedDocument(result);
  expect(commands.archiveSpec).toHaveBeenCalledOnce();
});

test.each([
  "成功",
  "失敗",
])("処理中アーカイブの%sがA→B→A切替後の状態や通知を変更しない", async (outcome) => {
  const result = renderSpecs();
  await flushLoads();
  const pending = deferred<ArchiveSpecResponse>();
  commands.archiveSpec.mockReturnValueOnce(pending.promise);
  let archive = Promise.resolve(false);
  act(() => {
    archive = result.current.actions.archiveSpec("spec-1");
  });
  expect(result.current.state.archivingSpecId).toBe("spec-1");
  result.rerender("/workspace/b");
  await flushLoads();
  expect.soft(result.current.state.archivingSpecId).toBeNull();
  result.rerender("/workspace/a");
  await flushLoads();
  const state = result.current.state;
  const notifications = onSelectionChange.mock.calls.length;
  const treeCalls = commands.listSpecs.mock.calls.length;
  const bundleCalls = commands.loadSpecBundle.mock.calls.length;

  await act(async () => {
    if (outcome === "成功") pending.resolve(response);
    else pending.reject({ code: "specArchive", message: "旧処理の失敗" });
    expect(await archive).toBe(false);
  });
  expect(result.current.state).toEqual(state);
  expect(result.current.state.archiveFailure).toBeNull();
  expect(result.current.state.archiveReveal).toBeNull();
  expect(commands.listSpecs).toHaveBeenCalledTimes(treeCalls);
  expect(commands.loadSpecBundle).toHaveBeenCalledTimes(bundleCalls);
  expect(onSelectionChange).toHaveBeenCalledTimes(notifications);
});

test("アーカイブ後の遅いツリー失敗は切替後の選択通知を消さない", async () => {
  const result = renderSpecs();
  await flushLoads();
  const pendingTree = deferred<SpecTree>();
  commands.archiveSpec.mockResolvedValueOnce(response);
  commands.listSpecs.mockReturnValueOnce(pendingTree.promise);
  let archive = Promise.resolve(false);
  act(() => {
    archive = result.current.actions.archiveSpec("spec-1");
  });
  await flushLoads();
  expect(commands.listSpecs).toHaveBeenCalledTimes(2);
  result.rerender("/workspace/b");
  await flushLoads();
  result.rerender("/workspace/a");
  await flushLoads();
  const currentState = result.current.state;
  const notifications = onSelectionChange.mock.calls.length;
  await act(async () => {
    pendingTree.reject({ code: "specTreeScan", message: "旧一覧の失敗" });
    expect(await archive).toBe(false);
  });
  expect(result.current.state).toEqual(currentState);
  expect(onSelectionChange).toHaveBeenCalledTimes(notifications);
});

test.each([
  "失敗",
  "移動先なし",
  "成功",
])("アーカイブの%s表示はワークスペース切替で解除する", async (outcome) => {
  const result = renderSpecs();
  await flushLoads();
  if (outcome === "失敗") {
    commands.archiveSpec.mockRejectedValueOnce({
      code: "specArchive",
      message: "移動失敗",
    });
  } else {
    commands.archiveSpec.mockResolvedValueOnce(response);
    if (outcome === "成功")
      commands.listSpecs.mockResolvedValueOnce(archivedTree);
  }
  await act(async () => {
    await result.current.actions.archiveSpec("spec-1");
  });
  expect(
    result.current.state.archiveFailure !== null ||
      result.current.state.archiveReveal !== null,
  ).toBe(true);
  result.rerender("/workspace/b");
  await flushLoads();
  expect(result.current.state.archiveFailure).toBeNull();
  expect(result.current.state.archiveSpecError).toBeNull();
  expect(result.current.state.archiveReveal).toBeNull();
  await act(async () => {
    expect(await result.current.actions.retryArchiveSpec()).toBe(false);
  });
  expect(commands.archiveSpec).toHaveBeenCalledOnce();
});
