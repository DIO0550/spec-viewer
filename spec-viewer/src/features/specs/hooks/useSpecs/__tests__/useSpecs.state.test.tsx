import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, expect, test, vi } from "vitest";
import { useSpecs } from "@/features/specs/hooks/useSpecs";
import type { SpecDocument, SpecTree } from "@/features/specs/types/spec";
import type { SpecCommands } from "@/shared/api/tauri";

const specCommandMocks = vi.hoisted(() => ({
  listSpecs: vi.fn<SpecCommands["listSpecs"]>(),
  readSpecFile: vi.fn<SpecCommands["readSpecFile"]>(),
  archiveSpec: vi.fn<SpecCommands["archiveSpec"]>(),
}));

vi.mock("@/shared/api/tauri", async (importActual) => {
  const actual = await importActual<typeof import("@/shared/api/tauri")>();

  return {
    ...actual,
    specCommands: specCommandMocks,
  };
});

void (specCommandMocks satisfies SpecCommands);

beforeEach(() => {
  specCommandMocks.listSpecs.mockReset();
  specCommandMocks.readSpecFile.mockReset();
  specCommandMocks.archiveSpec.mockReset();
});

const populatedTree: SpecTree = {
  specs: [
    {
      id: "phase-1-viewer",
      label: "Phase 1 Viewer",
      files: [
        {
          key: "tasks",
          label: "Tasks",
          fileName: "tasks.md",
          status: "present",
        },
      ],
      children: [],
    },
  ],
};

const nestedTree: SpecTree = {
  specs: [
    {
      id: "phase-root",
      label: "Phase Root",
      files: [],
      children: [
        {
          id: "phase-child",
          label: "Phase Child",
          files: [
            {
              key: "requirements",
              label: "Requirements",
              fileName: "requirements.html",
              status: "present",
            },
          ],
          children: [],
        },
      ],
    },
  ],
};

const refreshedNestedTree: SpecTree = {
  specs: [
    {
      id: "phase-root",
      label: "Phase Root",
      files: [],
      children: [
        {
          id: "phase-child",
          label: "Phase Child",
          files: [
            {
              key: "requirements",
              label: "Requirements",
              fileName: "requirements.html",
              status: "present",
            },
            {
              key: "tasks",
              label: "Tasks",
              fileName: "tasks.md",
              status: "present",
            },
          ],
          children: [],
        },
      ],
    },
    {
      id: "phase-new",
      label: "Phase New",
      files: [
        {
          key: "tasks",
          label: "Tasks",
          fileName: "tasks.md",
          status: "present",
        },
      ],
      children: [],
    },
  ],
};

const tasksAndDesignTree: SpecTree = {
  specs: [
    {
      id: "phase-refresh",
      label: "Phase Refresh",
      files: [
        {
          key: "requirements",
          label: "Requirements",
          fileName: "requirements.html",
          status: "present",
        },
        {
          key: "tasks",
          label: "Tasks",
          fileName: "tasks.md",
          status: "present",
        },
      ],
      children: [],
    },
  ],
};

const sixTabTree: SpecTree = {
  specs: [
    {
      id: "tech-reference-tab",
      label: "Tech Reference Tab",
      files: [
        {
          key: "impl",
          label: "Implementation",
          fileName: "implementation-plan.md",
          status: "present",
        },
        {
          key: "tasks",
          label: "Tasks",
          fileName: "tasks.md",
          status: "present",
        },
        {
          key: "tech-reference",
          label: "Tech Reference",
          fileName: "tech-reference.html",
          status: "missing",
          format: "html",
        },
        {
          key: "test-cases",
          label: "Test Cases",
          fileName: "test-cases.html",
          status: "missing",
          format: "html",
        },
        {
          key: "exploration",
          label: "Exploration",
          fileName: "exploration-report.md",
          status: "present",
        },
        {
          key: "hearing",
          label: "Hearing",
          fileName: "hearing-notes.md",
          status: "present",
        },
      ],
      children: [],
    },
  ],
};

const renamedTasksTree: SpecTree = {
  specs: [
    {
      id: "phase-refresh",
      label: "Phase Refresh",
      files: [
        {
          key: "requirements",
          label: "Requirements",
          fileName: "requirements.html",
          status: "present",
        },
      ],
      children: [],
    },
  ],
};

const missingTasksTree: SpecTree = {
  specs: [
    {
      id: "phase-1-viewer",
      label: "Phase 1 Viewer",
      files: [
        {
          key: "tasks",
          label: "Tasks",
          fileName: "tasks.md",
          status: "missing",
        },
      ],
      children: [],
    },
  ],
};

const loadedDocument: SpecDocument = {
  key: "tasks",
  path: "/workspace/spec-reviewer/.plugin-workspace/specs/phase-1-viewer/tasks.md",
  contents: "# Tasks",
  missing: false,
  blocks: [],
};

const missingDocument: SpecDocument = {
  key: "impl",
  path: "/workspace/spec-reviewer/.plugin-workspace/specs/phase-1-viewer/implementation-plan.md",
  contents: null,
  missing: true,
  blocks: [],
};

const missingTasksDocument: SpecDocument = {
  key: "tasks",
  path: "/workspace/spec-reviewer/.plugin-workspace/specs/phase-1-viewer/tasks.md",
  contents: null,
  missing: true,
  blocks: [],
};

const designDocument: SpecDocument = {
  key: "requirements",
  path: "/workspace/spec-reviewer/.plugin-workspace/specs/phase-child/requirements.html",
  contents: "# Requirements",
  missing: false,
  blocks: [],
};

const techReferenceDocument: SpecDocument = {
  key: "tech-reference",
  format: "html",
  path: "/workspace/spec-reviewer/.plugin-workspace/.specs/tech-reference-tab/tech-reference.html",
  contents: null,
  missing: true,
  blocks: [],
};

type HookResult<Props, Result> = Readonly<{
  current: Result;
  rerender: (nextProps: Props) => void;
  unmount: () => void;
}>;

type Deferred<T> = Readonly<{
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
}>;

function createDeferred<T>(): Deferred<T> {
  let resolveValue: (value: T) => void = () => undefined;
  let rejectValue: (error: unknown) => void = () => undefined;
  const promise = new Promise<T>((resolve, reject) => {
    resolveValue = resolve;
    rejectValue = reject;
  });

  return {
    promise,
    resolve: resolveValue,
    reject: rejectValue,
  };
}

function renderHook<Props, Result>(
  hook: (props: Props) => Result,
  initialProps: Props,
): HookResult<Props, Result> {
  const container = document.createElement("div");
  const root = createRoot(container);
  const props = { current: initialProps };
  const result = { current: undefined as Result };

  function TestComponent(): null {
    result.current = hook(props.current);
    return null;
  }

  act(() => {
    root.render(<TestComponent />);
  });

  return {
    get current() {
      return result.current;
    },
    rerender: (nextProps: Props) => {
      props.current = nextProps;
      act(() => {
        root.render(<TestComponent />);
      });
    },
    unmount: () => {
      act(() => {
        root.unmount();
      });
    },
  };
}

test("useSpecsはworkspace未選択ならspecとMarkdownをidleにする", () => {
  const result = renderHook(
    ({ workspacePath }) => useSpecs({ workspacePath }),
    { workspacePath: null as string | null },
  );

  expect(result.current.state.specTreeState.status).toBe("idle");
  expect(result.current.state.documentState.status).toBe("idle");
  expect(result.current.state.selection.specId).toBeNull();
  expect(result.current.state.selection.fileKey).toBeNull();
  result.unmount();
});

test("useSpecsはロード中だけ単一のisLoadingをtrueにする", async () => {
  const deferredTree = createDeferred<SpecTree>();
  const listSpecs = specCommandMocks.listSpecs.mockReturnValue(
    deferredTree.promise,
  );
  specCommandMocks.readSpecFile.mockResolvedValue(loadedDocument);

  const result = renderHook(
    ({ workspacePath }) => useSpecs({ workspacePath }),
    { workspacePath: "/workspace/spec-reviewer" },
  );

  expect(result.current.selectors.isLoading).toBe(true);

  const reload = result.current.actions.reloadSpecs();

  await act(async () => {
    deferredTree.resolve(populatedTree);
    await reload;
  });

  expect(listSpecs).toHaveBeenCalledOnce();
  expect(result.current.selectors.isLoading).toBe(false);
  expect(result.current.state.documentState.status).toBe("ready");
  result.unmount();
});

test("useSpecsはloading中のarchiveを実行しない", async () => {
  const deferredTree = createDeferred<SpecTree>();
  specCommandMocks.listSpecs.mockReturnValue(deferredTree.promise);
  specCommandMocks.readSpecFile.mockResolvedValue(loadedDocument);

  const result = renderHook(
    ({ workspacePath }) => useSpecs({ workspacePath }),
    { workspacePath: "/workspace/spec-reviewer" },
  );

  let archived = true;
  await act(async () => {
    archived = await result.current.actions.archiveSpec("phase-1-viewer");
  });

  const initialLoad = result.current.actions.reloadSpecs();

  await act(async () => {
    deferredTree.resolve(populatedTree);
    await initialLoad;
  });

  expect(archived).toBe(false);
  expect(specCommandMocks.archiveSpec).not.toHaveBeenCalled();
  result.unmount();
});

test("useSpecsはworkspace pathからspec treeを読み込みempty状態を表現する", async () => {
  specCommandMocks.listSpecs.mockResolvedValue({ specs: [] });
  const result = renderHook(
    ({ workspacePath }) => useSpecs({ workspacePath }),
    { workspacePath: "/workspace/spec-reviewer" },
  );

  await act(async () => {
    await result.current.actions.reloadSpecs();
  });

  expect(result.current.state.specTreeState).toEqual({
    status: "empty",
    workspacePath: "/workspace/spec-reviewer",
    tree: { specs: [] },
    error: null,
  });
  expect(result.current.state.selection.specId).toBeNull();
  result.unmount();
});

test("useSpecsはspec tree読み込み後に最初のspecとfileを選択してMarkdownを読み込む", async () => {
  specCommandMocks.listSpecs.mockResolvedValue(populatedTree);
  const readSpecFile =
    specCommandMocks.readSpecFile.mockResolvedValue(loadedDocument);

  const result = renderHook(
    ({ workspacePath }) => useSpecs({ workspacePath }),
    { workspacePath: "/workspace/spec-reviewer" },
  );

  await act(async () => {
    await result.current.actions.reloadSpecs();
  });

  expect(result.current.state.selection.specId).toBe("phase-1-viewer");
  expect(result.current.state.selection.fileKey).toBe("tasks");
  expect(result.current.state.documentState.status).toBe("ready");
  expect(readSpecFile).toHaveBeenCalledWith({
    workspacePath: "/workspace/spec-reviewer",
    specId: "phase-1-viewer",
    fileKey: "tasks",
    correlationId: expect.any(String),
  });
  result.unmount();
});

test("useSpecsは子階層にある最初のfile付きspecを初期選択する", async () => {
  specCommandMocks.listSpecs.mockResolvedValue(nestedTree);
  specCommandMocks.readSpecFile.mockResolvedValue(designDocument);

  const result = renderHook(
    ({ workspacePath }) => useSpecs({ workspacePath }),
    { workspacePath: "/workspace/spec-reviewer" },
  );

  await act(async () => {
    await result.current.actions.reloadSpecs();
  });

  expect(result.current.state.selection.specId).toBe("phase-child");
  expect(result.current.state.selection.fileKey).toBe("requirements");
  expect(result.current.state.documentState.status).toBe("ready");
  result.unmount();
});

test("useSpecsは選択したspec fileのMarkdownを読み込む", async () => {
  specCommandMocks.listSpecs.mockResolvedValue(populatedTree);
  const readSpecFile =
    specCommandMocks.readSpecFile.mockResolvedValue(loadedDocument);

  const result = renderHook(
    ({ workspacePath }) => useSpecs({ workspacePath }),
    { workspacePath: "/workspace/spec-reviewer" },
  );

  await act(async () => {
    await result.current.actions.reloadSpecs();
  });
  await act(async () => {
    await result.current.actions.selectSpec("phase-1-viewer");
  });
  await act(async () => {
    await result.current.actions.selectFileKey("tasks");
  });

  expect(result.current.state.documentState).toEqual(
    expect.objectContaining({
      status: "ready",
      workspacePath: "/workspace/spec-reviewer",
      specId: "phase-1-viewer",
      fileKey: "tasks",
      document: loadedDocument,
      error: null,
    }),
  );
  expect(readSpecFile).toHaveBeenCalledWith({
    workspacePath: "/workspace/spec-reviewer",
    specId: "phase-1-viewer",
    fileKey: "tasks",
    correlationId: expect.any(String),
  });
  result.unmount();
});

test("useSpecsはmissing Markdownをmissing状態として返す", async () => {
  specCommandMocks.listSpecs.mockResolvedValue(populatedTree);
  specCommandMocks.readSpecFile.mockResolvedValue(missingDocument);

  const result = renderHook(
    ({ workspacePath }) => useSpecs({ workspacePath }),
    { workspacePath: "/workspace/spec-reviewer" },
  );

  await act(async () => {
    await result.current.actions.reloadSpecs();
  });
  await act(async () => {
    await result.current.actions.selectSpec("phase-1-viewer");
  });
  await act(async () => {
    await result.current.actions.selectFileKey("impl");
  });

  expect(result.current.state.documentState).toEqual(
    expect.objectContaining({
      status: "missing",
      workspacePath: "/workspace/spec-reviewer",
      specId: "phase-1-viewer",
      fileKey: "impl",
      document: missingDocument,
      error: null,
    }),
  );
  result.unmount();
});

test("useSpecsはspec選択時に最初のfileを選択してMarkdownを読み込む", async () => {
  specCommandMocks.listSpecs.mockResolvedValue(nestedTree);
  specCommandMocks.readSpecFile.mockResolvedValue(designDocument);

  const result = renderHook(
    ({ workspacePath }) => useSpecs({ workspacePath }),
    { workspacePath: "/workspace/spec-reviewer" },
  );

  await act(async () => {
    await result.current.actions.reloadSpecs();
  });
  await act(async () => {
    await result.current.actions.selectSpec("phase-child");
  });

  expect(result.current.state.selection.fileKey).toBe("requirements");
  expect(result.current.state.documentState).toEqual(
    expect.objectContaining({
      status: "ready",
      workspacePath: "/workspace/spec-reviewer",
      specId: "phase-child",
      fileKey: "requirements",
      document: designDocument,
      error: null,
    }),
  );
  result.unmount();
});

test("useSpecsはfileを持たないspec選択時にspecだけ選択してMarkdown状態をidleにする", async () => {
  specCommandMocks.listSpecs.mockResolvedValue(nestedTree);
  specCommandMocks.readSpecFile.mockResolvedValue(designDocument);

  const result = renderHook(
    ({ workspacePath }) => useSpecs({ workspacePath }),
    { workspacePath: "/workspace/spec-reviewer" },
  );

  await act(async () => {
    await result.current.actions.reloadSpecs();
  });
  await act(async () => {
    await result.current.actions.selectSpec("phase-root");
  });

  expect(result.current.state.selection.specId).toBe("phase-root");
  expect(result.current.state.selection.fileKey).toBeNull();
  expect(result.current.state.documentState).toEqual(
    expect.objectContaining({
      status: "idle",
      workspacePath: "/workspace/spec-reviewer",
      specId: "phase-root",
      fileKey: null,
    }),
  );
  result.unmount();
});

test("useSpecsはworkspace変更時に選択状態とMarkdown状態をリセットする", async () => {
  specCommandMocks.listSpecs.mockResolvedValue(populatedTree);
  specCommandMocks.readSpecFile.mockResolvedValue(loadedDocument);

  const result = renderHook(
    ({ workspacePath }) => useSpecs({ workspacePath }),
    { workspacePath: "/workspace/spec-reviewer" },
  );

  await act(async () => {
    await result.current.actions.reloadSpecs();
  });
  await act(async () => {
    await result.current.actions.selectSpec("phase-1-viewer");
  });
  await act(async () => {
    await result.current.actions.selectFileKey("tasks");
  });

  result.rerender({ workspacePath: "/workspace/other" });

  expect(result.current.state.selection.specId).toBeNull();
  expect(result.current.state.selection.fileKey).toBeNull();
  expect(result.current.state.documentState.status).toBe("idle");
  result.unmount();
});

test("useSpecsはresetSelectionで選択状態とMarkdown状態をidleに戻す", async () => {
  specCommandMocks.listSpecs.mockResolvedValue(populatedTree);
  specCommandMocks.readSpecFile.mockResolvedValue(loadedDocument);

  const result = renderHook(
    ({ workspacePath }) => useSpecs({ workspacePath }),
    { workspacePath: "/workspace/spec-reviewer" },
  );

  await act(async () => {
    await result.current.actions.reloadSpecs();
  });

  act(() => {
    result.current.actions.resetSelection();
  });

  expect(result.current.state.selection.specId).toBeNull();
  expect(result.current.state.selection.fileKey).toBeNull();
  expect(result.current.state.documentState).toEqual(
    expect.objectContaining({
      status: "idle",
      workspacePath: "/workspace/spec-reviewer",
      specId: null,
      fileKey: null,
    }),
  );
  result.unmount();
});

test("useSpecsはspec tree再読み込み時に選択中のspecとfileを保持する", async () => {
  const listSpecs = specCommandMocks.listSpecs.mockResolvedValue(nestedTree);
  specCommandMocks.readSpecFile.mockResolvedValue(designDocument);

  const result = renderHook(
    ({ workspacePath }) => useSpecs({ workspacePath }),
    { workspacePath: "/workspace/spec-reviewer" },
  );

  await act(async () => {
    await result.current.actions.reloadSpecs();
  });
  listSpecs.mockResolvedValue(refreshedNestedTree);
  await act(async () => {
    await result.current.actions.reloadSpecs();
  });

  expect(result.current.state.selection.specId).toBe("phase-child");
  expect(result.current.state.selection.fileKey).toBe("requirements");
  expect(result.current.state.documentState).toEqual(
    expect.objectContaining({
      status: "ready",
      workspacePath: "/workspace/spec-reviewer",
      specId: "phase-child",
      fileKey: "requirements",
      document: designDocument,
      error: null,
    }),
  );
  result.unmount();
});

test("useSpecsはrefresh時に選択中fileが消えたら同じspecの先頭fileへ移る", async () => {
  const listSpecs =
    specCommandMocks.listSpecs.mockResolvedValue(tasksAndDesignTree);
  const readSpecFile =
    specCommandMocks.readSpecFile.mockResolvedValue(loadedDocument);

  const result = renderHook(
    ({ workspacePath }) => useSpecs({ workspacePath }),
    { workspacePath: "/workspace/spec-reviewer" },
  );

  await act(async () => {
    await result.current.actions.reloadSpecs();
  });
  await act(async () => {
    await result.current.actions.selectFileKey("tasks");
  });
  listSpecs.mockResolvedValue(renamedTasksTree);
  readSpecFile.mockResolvedValue(designDocument);
  await act(async () => {
    await result.current.actions.reloadSpecs();
  });

  expect(result.current.state.selection.specId).toBe("phase-refresh");
  expect(result.current.state.selection.fileKey).toBe("requirements");
  expect(result.current.state.documentState).toEqual(
    expect.objectContaining({
      status: "ready",
      workspacePath: "/workspace/spec-reviewer",
      specId: "phase-refresh",
      fileKey: "requirements",
      document: designDocument,
      error: null,
    }),
  );
  result.unmount();
});

test("useSpecsは6タブ構成でも選択中のTech Referenceをrefresh後に保持する", async () => {
  specCommandMocks.listSpecs.mockResolvedValue(sixTabTree);
  specCommandMocks.readSpecFile
    .mockResolvedValueOnce(missingDocument)
    .mockResolvedValue(techReferenceDocument);

  const result = renderHook(
    ({ workspacePath }) => useSpecs({ workspacePath }),
    { workspacePath: "/workspace/spec-reviewer" },
  );

  await act(async () => {
    await result.current.actions.reloadSpecs();
  });
  await act(async () => {
    await result.current.actions.selectFileKey("tech-reference");
  });
  await act(async () => {
    await result.current.actions.reloadSpecs();
  });

  expect(result.current.state.selection.specId).toBe("tech-reference-tab");
  expect(result.current.state.selection.fileKey).toBe("tech-reference");
  expect(result.current.state.documentState).toEqual(
    expect.objectContaining({
      status: "missing",
      workspacePath: "/workspace/spec-reviewer",
      specId: "tech-reference-tab",
      fileKey: "tech-reference",
      document: techReferenceDocument,
      error: null,
    }),
  );
  result.unmount();
});

test("useSpecsはrefresh時に選択中Markdownが削除されたらmissing状態へ更新する", async () => {
  const listSpecs = specCommandMocks.listSpecs.mockResolvedValue(populatedTree);
  const readSpecFile =
    specCommandMocks.readSpecFile.mockResolvedValue(loadedDocument);

  const result = renderHook(
    ({ workspacePath }) => useSpecs({ workspacePath }),
    { workspacePath: "/workspace/spec-reviewer" },
  );

  await act(async () => {
    await result.current.actions.reloadSpecs();
  });
  listSpecs.mockResolvedValue(missingTasksTree);
  readSpecFile.mockResolvedValue(missingTasksDocument);
  await act(async () => {
    await result.current.actions.reloadSpecs();
  });

  expect(result.current.state.selection.specId).toBe("phase-1-viewer");
  expect(result.current.state.selection.fileKey).toBe("tasks");
  expect(result.current.state.documentState).toEqual(
    expect.objectContaining({
      status: "missing",
      workspacePath: "/workspace/spec-reviewer",
      specId: "phase-1-viewer",
      fileKey: "tasks",
      document: missingTasksDocument,
      error: null,
    }),
  );
  result.unmount();
});

test("useSpecsはworkspace変更後に古いspec tree responseで最新stateを上書きしない", async () => {
  const oldWorkspaceTree = createDeferred<SpecTree>();
  const newWorkspaceTree = createDeferred<SpecTree>();
  const listSpecs = specCommandMocks.listSpecs
    .mockReturnValueOnce(oldWorkspaceTree.promise)
    .mockReturnValueOnce(newWorkspaceTree.promise);
  const readSpecFile =
    specCommandMocks.readSpecFile.mockResolvedValue(loadedDocument);

  const result = renderHook(
    ({ workspacePath }) => useSpecs({ workspacePath }),
    { workspacePath: "/workspace/spec-reviewer" },
  );

  result.rerender({ workspacePath: "/workspace/other" });

  await act(async () => {
    newWorkspaceTree.resolve(populatedTree);
    await newWorkspaceTree.promise;
  });
  await act(async () => {
    oldWorkspaceTree.resolve({ specs: [] });
    await oldWorkspaceTree.promise;
  });

  expect(listSpecs).toHaveBeenNthCalledWith(1, "/workspace/spec-reviewer");
  expect(listSpecs).toHaveBeenNthCalledWith(2, "/workspace/other");
  expect(result.current.state.specTreeState).toEqual(
    expect.objectContaining({
      status: "ready",
      workspacePath: "/workspace/other",
    }),
  );
  expect(result.current.state.selection.specId).toBe("phase-1-viewer");
  expect(readSpecFile).toHaveBeenCalledWith({
    workspacePath: "/workspace/other",
    specId: "phase-1-viewer",
    fileKey: "tasks",
    correlationId: expect.any(String),
  });
  result.unmount();
});

test("useSpecsはworkspace変更後に古いmanual reload responseで最新stateを上書きしない", async () => {
  const oldWorkspaceReload = createDeferred<SpecTree>();
  const newWorkspaceTree = createDeferred<SpecTree>();
  const listSpecs = specCommandMocks.listSpecs
    .mockResolvedValueOnce(populatedTree)
    .mockReturnValueOnce(oldWorkspaceReload.promise)
    .mockReturnValueOnce(newWorkspaceTree.promise);
  specCommandMocks.readSpecFile.mockResolvedValue(loadedDocument);

  const result = renderHook(
    ({ workspacePath }) => useSpecs({ workspacePath }),
    { workspacePath: "/workspace/spec-reviewer" },
  );

  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });

  const reload = result.current.actions.reloadSpecs();
  await act(async () => {
    await Promise.resolve();
  });

  result.rerender({ workspacePath: "/workspace/other" });

  await act(async () => {
    newWorkspaceTree.resolve(populatedTree);
    await newWorkspaceTree.promise;
  });
  await act(async () => {
    oldWorkspaceReload.resolve({ specs: [] });
    await reload;
  });

  expect(listSpecs).toHaveBeenNthCalledWith(2, "/workspace/spec-reviewer");
  expect(listSpecs).toHaveBeenNthCalledWith(3, "/workspace/other");
  expect(result.current.state.specTreeState).toEqual(
    expect.objectContaining({
      status: "ready",
      workspacePath: "/workspace/other",
    }),
  );
  expect(result.current.state.selection.specId).toBe("phase-1-viewer");
  result.unmount();
});

test("useSpecsは同じworkspace pathへ戻った後も古いmanual reload responseで最新stateを上書きしない", async () => {
  const oldWorkspaceReload = createDeferred<SpecTree>();
  const listSpecs = specCommandMocks.listSpecs
    .mockResolvedValueOnce(populatedTree)
    .mockReturnValueOnce(oldWorkspaceReload.promise)
    .mockResolvedValueOnce(populatedTree)
    .mockResolvedValueOnce(populatedTree);
  specCommandMocks.readSpecFile.mockResolvedValue(loadedDocument);

  const result = renderHook(
    ({ workspacePath }) => useSpecs({ workspacePath }),
    { workspacePath: "/workspace/spec-reviewer" },
  );

  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });

  const reload = result.current.actions.reloadSpecs();
  await act(async () => {
    await Promise.resolve();
  });

  result.rerender({ workspacePath: "/workspace/other" });
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });

  result.rerender({ workspacePath: "/workspace/spec-reviewer" });
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });

  await act(async () => {
    oldWorkspaceReload.resolve({ specs: [] });
    await reload;
  });

  expect(listSpecs).toHaveBeenNthCalledWith(2, "/workspace/spec-reviewer");
  expect(listSpecs).toHaveBeenNthCalledWith(3, "/workspace/other");
  expect(listSpecs).toHaveBeenNthCalledWith(4, "/workspace/spec-reviewer");
  expect(result.current.state.specTreeState).toEqual(
    expect.objectContaining({
      status: "ready",
      workspacePath: "/workspace/spec-reviewer",
    }),
  );
  expect(result.current.state.selection.specId).toBe("phase-1-viewer");
  result.unmount();
});

test("useSpecsはworkspace変更後に古いdocument responseで最新document stateを上書きしない", async () => {
  const oldWorkspaceDocument = createDeferred<SpecDocument>();
  specCommandMocks.listSpecs.mockResolvedValue(populatedTree);
  const readSpecFile = specCommandMocks.readSpecFile
    .mockReturnValueOnce(oldWorkspaceDocument.promise)
    .mockResolvedValueOnce(loadedDocument);

  const result = renderHook(
    ({ workspacePath }) => useSpecs({ workspacePath }),
    { workspacePath: "/workspace/spec-reviewer" },
  );

  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });

  result.rerender({ workspacePath: "/workspace/other" });

  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
  await act(async () => {
    oldWorkspaceDocument.resolve(designDocument);
    await oldWorkspaceDocument.promise;
  });

  expect(readSpecFile).toHaveBeenNthCalledWith(1, {
    workspacePath: "/workspace/spec-reviewer",
    specId: "phase-1-viewer",
    fileKey: "tasks",
    correlationId: expect.any(String),
  });
  expect(readSpecFile).toHaveBeenNthCalledWith(2, {
    workspacePath: "/workspace/other",
    specId: "phase-1-viewer",
    fileKey: "tasks",
    correlationId: expect.any(String),
  });
  expect(result.current.state.documentState).toEqual(
    expect.objectContaining({
      status: "ready",
      workspacePath: "/workspace/other",
      fileKey: "tasks",
      document: loadedDocument,
    }),
  );
  result.unmount();
});

test("useSpecsはarchive完了後のreloadでworkspace変更後のstateを上書きしない", async () => {
  const archiveResult = {
    archivedSpecId: "phase-1-viewer",
    archivePath:
      "/workspace/spec-reviewer/.plugin-workspace/.specs/.archive/phase-1-viewer",
  };
  const newWorkspaceTree = createDeferred<SpecTree>();
  const listSpecs = specCommandMocks.listSpecs
    .mockResolvedValueOnce(populatedTree)
    .mockReturnValueOnce(newWorkspaceTree.promise)
    .mockResolvedValueOnce({ specs: [] });
  const deferredArchive = createDeferred<typeof archiveResult>();
  specCommandMocks.readSpecFile.mockResolvedValue(loadedDocument);
  specCommandMocks.archiveSpec.mockReturnValue(deferredArchive.promise);

  const result = renderHook(
    ({ workspacePath }) => useSpecs({ workspacePath }),
    { workspacePath: "/workspace/spec-reviewer" },
  );

  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });

  const archive = result.current.actions.archiveSpec("phase-1-viewer");
  await act(async () => {
    await Promise.resolve();
  });

  result.rerender({ workspacePath: "/workspace/other" });

  await act(async () => {
    newWorkspaceTree.resolve(populatedTree);
    await newWorkspaceTree.promise;
  });
  await act(async () => {
    deferredArchive.resolve(archiveResult);
    await archive;
  });

  expect(listSpecs).toHaveBeenNthCalledWith(1, "/workspace/spec-reviewer");
  expect(listSpecs).toHaveBeenNthCalledWith(2, "/workspace/other");
  expect(result.current.state.specTreeState).toEqual(
    expect.objectContaining({
      status: "ready",
      workspacePath: "/workspace/other",
    }),
  );
  expect(result.current.state.selection.specId).toBe("phase-1-viewer");
  result.unmount();
});

test("useSpecsはspecをアーカイブした後にtreeを再読み込みする", async () => {
  const listSpecs = specCommandMocks.listSpecs.mockResolvedValue(populatedTree);
  specCommandMocks.readSpecFile.mockResolvedValue(loadedDocument);
  const archiveSpec = specCommandMocks.archiveSpec.mockResolvedValue({
    archivedSpecId: "phase-1-viewer",
    archivePath:
      "/workspace/spec-reviewer/.plugin-workspace/.specs/.archive/phase-1-viewer",
  });

  const result = renderHook(
    ({ workspacePath }) => useSpecs({ workspacePath }),
    { workspacePath: "/workspace/spec-reviewer" },
  );

  await act(async () => {
    await result.current.actions.reloadSpecs();
  });
  listSpecs.mockResolvedValue({ specs: [] });
  await act(async () => {
    await result.current.actions.archiveSpec("phase-1-viewer");
  });

  expect(archiveSpec).toHaveBeenCalledWith({
    workspacePath: "/workspace/spec-reviewer",
    specId: "phase-1-viewer",
  });
  expect(result.current.state.specTreeState.status).toBe("empty");
  expect(result.current.state.selection.specId).toBeNull();
  result.unmount();
});

test("useSpecsはarchive中の追加archiveを実行しない", async () => {
  const archiveResult = {
    archivedSpecId: "phase-1-viewer",
    archivePath:
      "/workspace/spec-reviewer/.plugin-workspace/.specs/.archive/phase-1-viewer",
  };
  const deferredArchive = createDeferred<typeof archiveResult>();
  specCommandMocks.listSpecs.mockResolvedValue(populatedTree);
  specCommandMocks.readSpecFile.mockResolvedValue(loadedDocument);
  const archiveSpec = specCommandMocks.archiveSpec.mockReturnValue(
    deferredArchive.promise,
  );

  const result = renderHook(
    ({ workspacePath }) => useSpecs({ workspacePath }),
    { workspacePath: "/workspace/spec-reviewer" },
  );

  await act(async () => {
    await result.current.actions.reloadSpecs();
  });

  let secondArchived = true;
  const firstArchive = result.current.actions.archiveSpec("phase-1-viewer");
  await act(async () => {
    await Promise.resolve();
  });
  await act(async () => {
    secondArchived = await result.current.actions.archiveSpec("phase-1-viewer");
  });
  await act(async () => {
    deferredArchive.resolve(archiveResult);
    await firstArchive;
  });

  expect(secondArchived).toBe(false);
  expect(archiveSpec).toHaveBeenCalledOnce();
  result.unmount();
});

test("useSpecsは同一tickの追加archiveを実行しない", async () => {
  const archiveResult = {
    archivedSpecId: "phase-1-viewer",
    archivePath:
      "/workspace/spec-reviewer/.plugin-workspace/.specs/.archive/phase-1-viewer",
  };
  const deferredArchive = createDeferred<typeof archiveResult>();
  specCommandMocks.listSpecs.mockResolvedValue(populatedTree);
  specCommandMocks.readSpecFile.mockResolvedValue(loadedDocument);
  const archiveSpec = specCommandMocks.archiveSpec.mockReturnValue(
    deferredArchive.promise,
  );

  const result = renderHook(
    ({ workspacePath }) => useSpecs({ workspacePath }),
    { workspacePath: "/workspace/spec-reviewer" },
  );

  await act(async () => {
    await result.current.actions.reloadSpecs();
  });

  let secondArchived = true;
  const firstArchive = result.current.actions.archiveSpec("phase-1-viewer");
  const secondArchive = result.current.actions.archiveSpec("phase-1-viewer");

  await act(async () => {
    secondArchived = await secondArchive;
  });
  await act(async () => {
    deferredArchive.resolve(archiveResult);
    await firstArchive;
  });

  expect(secondArchived).toBe(false);
  expect(archiveSpec).toHaveBeenCalledOnce();
  result.unmount();
});

test("useSpecsはarchive error stateを保持して現在のtreeを維持する", async () => {
  const archiveError = new Error("archive failed");
  specCommandMocks.listSpecs.mockResolvedValue(populatedTree);
  specCommandMocks.readSpecFile.mockResolvedValue(loadedDocument);
  specCommandMocks.archiveSpec.mockRejectedValue(archiveError);

  const result = renderHook(
    ({ workspacePath }) => useSpecs({ workspacePath }),
    { workspacePath: "/workspace/spec-reviewer" },
  );

  await act(async () => {
    await result.current.actions.reloadSpecs();
  });

  let archived = true;
  await act(async () => {
    archived = await result.current.actions.archiveSpec("phase-1-viewer");
  });

  expect(archived).toBe(false);
  expect(result.current.state.archiveSpecError).toEqual({
    feature: "specs",
    code: "unknown",
    message: "archive failed",
    cause: {
      command: "archive_spec",
      code: "unknown",
      message: "archive failed",
      raw: archiveError,
    },
  });
  expect(result.current.state.archivingSpecId).toBeNull();
  expect(result.current.state.specTreeState.status).toBe("ready");
  expect(result.current.state.selection.specId).toBe("phase-1-viewer");
  result.unmount();
});

test("useSpecsはlistSpecs errorでtreeをerrorにしてselectionをresetする", async () => {
  const scanError = new Error("scan failed");
  specCommandMocks.listSpecs.mockRejectedValue(scanError);

  const result = renderHook(
    ({ workspacePath }) => useSpecs({ workspacePath }),
    { workspacePath: "/workspace/spec-reviewer" },
  );

  let loaded = true;
  await act(async () => {
    loaded = await result.current.actions.reloadSpecs();
  });

  expect(loaded).toBe(false);
  expect(result.current.state.specTreeState).toEqual({
    status: "error",
    workspacePath: "/workspace/spec-reviewer",
    tree: null,
    error: {
      feature: "specs",
      code: "unknown",
      message: "scan failed",
      cause: {
        command: "list_specs",
        code: "unknown",
        message: "scan failed",
        raw: scanError,
      },
    },
  });
  expect(result.current.state.selection.specId).toBeNull();
  expect(result.current.state.selection.fileKey).toBeNull();
  result.unmount();
});

test("useSpecsはreadSpecFile errorでdocumentをerrorにしてtree selectionを維持する", async () => {
  const readError = new Error("read failed");
  specCommandMocks.listSpecs.mockResolvedValue(populatedTree);
  specCommandMocks.readSpecFile.mockRejectedValue(readError);

  const result = renderHook(
    ({ workspacePath }) => useSpecs({ workspacePath }),
    { workspacePath: "/workspace/spec-reviewer" },
  );

  let loaded = true;
  await act(async () => {
    loaded = await result.current.actions.reloadSpecs();
  });

  expect(loaded).toBe(false);
  expect(result.current.state.selection.specId).toBe("phase-1-viewer");
  expect(result.current.state.selection.fileKey).toBe("tasks");
  expect(result.current.state.documentState).toEqual(
    expect.objectContaining({
      status: "error",
      workspacePath: "/workspace/spec-reviewer",
      specId: "phase-1-viewer",
      fileKey: "tasks",
      error: {
        feature: "specs",
        code: "unknown",
        message: "read failed",
        cause: {
          command: "read_spec_file",
          code: "unknown",
          message: "read failed",
          raw: readError,
        },
      },
    }),
  );
  result.unmount();
});

test("useSpecsはarchive errorをreloadやselectionで保持し次のarchive開始時にclearする", async () => {
  const archiveError = new Error("archive failed");
  specCommandMocks.listSpecs.mockResolvedValue(populatedTree);
  specCommandMocks.readSpecFile.mockResolvedValue(loadedDocument);
  specCommandMocks.archiveSpec
    .mockRejectedValueOnce(archiveError)
    .mockResolvedValueOnce({
      archivedSpecId: "phase-1-viewer",
      archivePath:
        "/workspace/spec-reviewer/.plugin-workspace/.specs/.archive/phase-1-viewer",
    });

  const result = renderHook(
    ({ workspacePath }) => useSpecs({ workspacePath }),
    { workspacePath: "/workspace/spec-reviewer" },
  );

  await act(async () => {
    await result.current.actions.reloadSpecs();
  });
  await act(async () => {
    await result.current.actions.archiveSpec("phase-1-viewer");
  });

  expect(result.current.state.archiveSpecError?.message).toBe("archive failed");

  await act(async () => {
    await result.current.actions.reloadSpecs();
  });
  await act(async () => {
    await result.current.actions.selectFileKey("tasks");
  });

  expect(result.current.state.archiveSpecError?.message).toBe("archive failed");

  await act(async () => {
    await result.current.actions.archiveSpec("phase-1-viewer");
  });

  expect(result.current.state.archiveSpecError).toBeNull();
  result.unmount();
});

test("useSpecsはarchive後に選択中specが消えたらdefault openable specへfallbackする", async () => {
  const onSelectionChange = vi.fn();
  specCommandMocks.listSpecs
    .mockResolvedValueOnce(populatedTree)
    .mockResolvedValueOnce(refreshedNestedTree);
  specCommandMocks.readSpecFile
    .mockResolvedValueOnce(loadedDocument)
    .mockResolvedValueOnce(loadedDocument)
    .mockResolvedValueOnce(designDocument);
  specCommandMocks.archiveSpec.mockResolvedValue({
    archivedSpecId: "phase-1-viewer",
    archivePath:
      "/workspace/spec-reviewer/.plugin-workspace/.specs/.archive/phase-1-viewer",
  });

  const result = renderHook(
    ({ workspacePath }) => useSpecs({ workspacePath, onSelectionChange }),
    { workspacePath: "/workspace/spec-reviewer" },
  );

  await act(async () => {
    await result.current.actions.reloadSpecs();
  });
  await act(async () => {
    await result.current.actions.archiveSpec("phase-1-viewer");
  });

  expect(result.current.state.selection.specId).toBe("phase-child");
  expect(result.current.state.selection.fileKey).toBe("requirements");
  expect(onSelectionChange).toHaveBeenLastCalledWith({
    workspacePath: "/workspace/spec-reviewer",
    specId: "phase-child",
    fileKey: "requirements",
  });
  result.unmount();
});

test("useSpecsはworkspace changeでarchive errorをclearする", async () => {
  const archiveError = new Error("archive failed");
  specCommandMocks.listSpecs.mockResolvedValue(populatedTree);
  specCommandMocks.readSpecFile.mockResolvedValue(loadedDocument);
  specCommandMocks.archiveSpec.mockRejectedValue(archiveError);

  const result = renderHook(
    ({ workspacePath }) => useSpecs({ workspacePath }),
    { workspacePath: "/workspace/spec-reviewer" },
  );

  await act(async () => {
    await result.current.actions.reloadSpecs();
  });
  await act(async () => {
    await result.current.actions.archiveSpec("phase-1-viewer");
  });

  expect(result.current.state.archiveSpecError?.message).toBe("archive failed");

  result.rerender({ workspacePath: "/workspace/other" });

  expect(result.current.state.archiveSpecError).toBeNull();
  result.unmount();
});

test("useSpecsはarchive実行中のworkspace changeでarchivingSpecIdを残留させない", async () => {
  const archiveResult = {
    archivedSpecId: "phase-1-viewer",
    archivePath:
      "/workspace/spec-reviewer/.plugin-workspace/.specs/.archive/phase-1-viewer",
  };
  const deferredArchive = createDeferred<typeof archiveResult>();
  specCommandMocks.listSpecs.mockResolvedValue(populatedTree);
  specCommandMocks.readSpecFile.mockResolvedValue(loadedDocument);
  specCommandMocks.archiveSpec.mockReturnValue(deferredArchive.promise);

  const result = renderHook(
    ({ workspacePath }) => useSpecs({ workspacePath }),
    { workspacePath: "/workspace/spec-reviewer" },
  );

  await act(async () => {
    await result.current.actions.reloadSpecs();
  });

  const archive = result.current.actions.archiveSpec("phase-1-viewer");
  await act(async () => {
    await Promise.resolve();
  });

  expect(result.current.state.archivingSpecId).toBe("phase-1-viewer");

  result.rerender({ workspacePath: "/workspace/other" });

  expect(result.current.state.archivingSpecId).toBeNull();

  await act(async () => {
    deferredArchive.resolve(archiveResult);
    await archive;
  });

  expect(result.current.state.archivingSpecId).toBeNull();
  result.unmount();
});
