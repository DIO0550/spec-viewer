import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import { useSpecs } from "@/features/specs/hooks/useSpecs";
import type { SpecDocument, SpecTree } from "@/features/specs/types/spec";

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
              key: "design",
              label: "Design",
              fileName: "design.md",
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
              key: "design",
              label: "Design",
              fileName: "design.md",
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
          key: "design",
          label: "Design",
          fileName: "design.md",
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

const fiveTabTree: SpecTree = {
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
          key: "design",
          label: "Design",
          fileName: "design.md",
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
  key: "design",
  path: "/workspace/spec-reviewer/.plugin-workspace/specs/phase-child/design.md",
  contents: "# Design",
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
  const listSpecs = vi.fn();
  const readSpecFile = vi.fn();

  const result = renderHook(
    ({ workspacePath }) => useSpecs({ workspacePath, listSpecs, readSpecFile }),
    { workspacePath: null as string | null },
  );

  expect(result.current.specTreeState.status).toBe("idle");
  expect(result.current.documentState.status).toBe("idle");
  expect(result.current.selectedSpecId).toBeNull();
  expect(result.current.selectedFileKey).toBeNull();
  result.unmount();
});

test("useSpecsはworkspace pathからspec treeを読み込みempty状態を表現する", async () => {
  const listSpecs = vi.fn().mockResolvedValue({ specs: [] });
  const readSpecFile = vi.fn();

  const result = renderHook(
    ({ workspacePath }) => useSpecs({ workspacePath, listSpecs, readSpecFile }),
    { workspacePath: "/workspace/spec-reviewer" },
  );

  await act(async () => {
    await result.current.reloadSpecs();
  });

  expect(result.current.specTreeState).toEqual({
    status: "empty",
    workspacePath: "/workspace/spec-reviewer",
    tree: { specs: [] },
    error: null,
  });
  expect(result.current.selectedSpecId).toBeNull();
  result.unmount();
});

test("useSpecsはspec tree読み込み後に最初のspecとfileを選択してMarkdownを読み込む", async () => {
  const listSpecs = vi.fn().mockResolvedValue(populatedTree);
  const readSpecFile = vi.fn().mockResolvedValue(loadedDocument);

  const result = renderHook(
    ({ workspacePath }) => useSpecs({ workspacePath, listSpecs, readSpecFile }),
    { workspacePath: "/workspace/spec-reviewer" },
  );

  await act(async () => {
    await result.current.reloadSpecs();
  });

  expect(result.current.selectedSpecId).toBe("phase-1-viewer");
  expect(result.current.selectedFileKey).toBe("tasks");
  expect(result.current.documentState.status).toBe("ready");
  expect(readSpecFile).toHaveBeenCalledWith({
    workspacePath: "/workspace/spec-reviewer",
    specId: "phase-1-viewer",
    fileKey: "tasks",
    correlationId: expect.any(String),
  });
  result.unmount();
});

test("useSpecsは子階層にある最初のfile付きspecを初期選択する", async () => {
  const listSpecs = vi.fn().mockResolvedValue(nestedTree);
  const readSpecFile = vi.fn().mockResolvedValue(designDocument);

  const result = renderHook(
    ({ workspacePath }) => useSpecs({ workspacePath, listSpecs, readSpecFile }),
    { workspacePath: "/workspace/spec-reviewer" },
  );

  await act(async () => {
    await result.current.reloadSpecs();
  });

  expect(result.current.selectedSpecId).toBe("phase-child");
  expect(result.current.selectedFileKey).toBe("design");
  expect(result.current.documentState.status).toBe("ready");
  result.unmount();
});

test("useSpecsは選択したspec fileのMarkdownを読み込む", async () => {
  const listSpecs = vi.fn().mockResolvedValue(populatedTree);
  const readSpecFile = vi.fn().mockResolvedValue(loadedDocument);

  const result = renderHook(
    ({ workspacePath }) => useSpecs({ workspacePath, listSpecs, readSpecFile }),
    { workspacePath: "/workspace/spec-reviewer" },
  );

  await act(async () => {
    await result.current.reloadSpecs();
  });
  await act(async () => {
    await result.current.selectSpec("phase-1-viewer");
  });
  await act(async () => {
    await result.current.selectFileKey("tasks");
  });

  expect(result.current.documentState).toEqual(
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
  const listSpecs = vi.fn().mockResolvedValue(populatedTree);
  const readSpecFile = vi.fn().mockResolvedValue(missingDocument);

  const result = renderHook(
    ({ workspacePath }) => useSpecs({ workspacePath, listSpecs, readSpecFile }),
    { workspacePath: "/workspace/spec-reviewer" },
  );

  await act(async () => {
    await result.current.reloadSpecs();
  });
  await act(async () => {
    await result.current.selectSpec("phase-1-viewer");
  });
  await act(async () => {
    await result.current.selectFileKey("impl");
  });

  expect(result.current.documentState).toEqual(
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
  const listSpecs = vi.fn().mockResolvedValue(nestedTree);
  const readSpecFile = vi.fn().mockResolvedValue(designDocument);

  const result = renderHook(
    ({ workspacePath }) => useSpecs({ workspacePath, listSpecs, readSpecFile }),
    { workspacePath: "/workspace/spec-reviewer" },
  );

  await act(async () => {
    await result.current.reloadSpecs();
  });
  await act(async () => {
    await result.current.selectSpec("phase-child");
  });

  expect(result.current.selectedFileKey).toBe("design");
  expect(result.current.documentState).toEqual(
    expect.objectContaining({
      status: "ready",
      workspacePath: "/workspace/spec-reviewer",
      specId: "phase-child",
      fileKey: "design",
      document: designDocument,
      error: null,
    }),
  );
  result.unmount();
});

test("useSpecsはworkspace変更時に選択状態とMarkdown状態をリセットする", async () => {
  const listSpecs = vi.fn().mockResolvedValue(populatedTree);
  const readSpecFile = vi.fn().mockResolvedValue(loadedDocument);

  const result = renderHook(
    ({ workspacePath }) => useSpecs({ workspacePath, listSpecs, readSpecFile }),
    { workspacePath: "/workspace/spec-reviewer" },
  );

  await act(async () => {
    await result.current.reloadSpecs();
  });
  await act(async () => {
    await result.current.selectSpec("phase-1-viewer");
  });
  await act(async () => {
    await result.current.selectFileKey("tasks");
  });

  result.rerender({ workspacePath: "/workspace/other" });

  expect(result.current.selectedSpecId).toBeNull();
  expect(result.current.selectedFileKey).toBeNull();
  expect(result.current.documentState.status).toBe("idle");
  result.unmount();
});

test("useSpecsはspec tree再読み込み時に選択中のspecとfileを保持する", async () => {
  const listSpecs = vi.fn().mockResolvedValue(nestedTree);
  const readSpecFile = vi.fn().mockResolvedValue(designDocument);

  const result = renderHook(
    ({ workspacePath }) => useSpecs({ workspacePath, listSpecs, readSpecFile }),
    { workspacePath: "/workspace/spec-reviewer" },
  );

  await act(async () => {
    await result.current.reloadSpecs();
  });
  listSpecs.mockResolvedValue(refreshedNestedTree);
  await act(async () => {
    await result.current.reloadSpecs({ preserveSelection: true });
  });

  expect(result.current.selectedSpecId).toBe("phase-child");
  expect(result.current.selectedFileKey).toBe("design");
  expect(result.current.documentState).toEqual(
    expect.objectContaining({
      status: "ready",
      workspacePath: "/workspace/spec-reviewer",
      specId: "phase-child",
      fileKey: "design",
      document: designDocument,
      error: null,
    }),
  );
  result.unmount();
});

test("useSpecsはrefresh時に選択中fileが消えたら同じspecの先頭fileへ移る", async () => {
  const listSpecs = vi.fn().mockResolvedValue(tasksAndDesignTree);
  const readSpecFile = vi.fn().mockResolvedValue(loadedDocument);

  const result = renderHook(
    ({ workspacePath }) => useSpecs({ workspacePath, listSpecs, readSpecFile }),
    { workspacePath: "/workspace/spec-reviewer" },
  );

  await act(async () => {
    await result.current.reloadSpecs();
  });
  await act(async () => {
    await result.current.selectFileKey("tasks");
  });
  listSpecs.mockResolvedValue(renamedTasksTree);
  readSpecFile.mockResolvedValue(designDocument);
  await act(async () => {
    await result.current.reloadSpecs({ preserveSelection: true });
  });

  expect(result.current.selectedSpecId).toBe("phase-refresh");
  expect(result.current.selectedFileKey).toBe("design");
  expect(result.current.documentState).toEqual(
    expect.objectContaining({
      status: "ready",
      workspacePath: "/workspace/spec-reviewer",
      specId: "phase-refresh",
      fileKey: "design",
      document: designDocument,
      error: null,
    }),
  );
  result.unmount();
});

test("useSpecsは5タブ構成でも選択中のTech Referenceをrefresh後に保持する", async () => {
  const listSpecs = vi.fn().mockResolvedValue(fiveTabTree);
  const readSpecFile = vi
    .fn()
    .mockResolvedValueOnce(missingDocument)
    .mockResolvedValue(techReferenceDocument);

  const result = renderHook(
    ({ workspacePath }) => useSpecs({ workspacePath, listSpecs, readSpecFile }),
    { workspacePath: "/workspace/spec-reviewer" },
  );

  await act(async () => {
    await result.current.reloadSpecs();
  });
  await act(async () => {
    await result.current.selectFileKey("tech-reference");
  });
  await act(async () => {
    await result.current.reloadSpecs({ preserveSelection: true });
  });

  expect(result.current.selectedSpecId).toBe("tech-reference-tab");
  expect(result.current.selectedFileKey).toBe("tech-reference");
  expect(result.current.documentState).toEqual(
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
  const listSpecs = vi.fn().mockResolvedValue(populatedTree);
  const readSpecFile = vi.fn().mockResolvedValue(loadedDocument);

  const result = renderHook(
    ({ workspacePath }) => useSpecs({ workspacePath, listSpecs, readSpecFile }),
    { workspacePath: "/workspace/spec-reviewer" },
  );

  await act(async () => {
    await result.current.reloadSpecs();
  });
  listSpecs.mockResolvedValue(missingTasksTree);
  readSpecFile.mockResolvedValue(missingTasksDocument);
  await act(async () => {
    await result.current.reloadSpecs({ preserveSelection: true });
  });

  expect(result.current.selectedSpecId).toBe("phase-1-viewer");
  expect(result.current.selectedFileKey).toBe("tasks");
  expect(result.current.documentState).toEqual(
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

test("useSpecsはspecをアーカイブした後にtreeを再読み込みする", async () => {
  const listSpecs = vi.fn().mockResolvedValue(populatedTree);
  const readSpecFile = vi.fn().mockResolvedValue(loadedDocument);
  const archiveSpec = vi.fn().mockResolvedValue({
    archivedSpecId: "phase-1-viewer",
    archivePath:
      "/workspace/spec-reviewer/.plugin-workspace/.specs/.archive/phase-1-viewer",
  });

  const result = renderHook(
    ({ workspacePath }) =>
      useSpecs({ workspacePath, listSpecs, readSpecFile, archiveSpec }),
    { workspacePath: "/workspace/spec-reviewer" },
  );

  await act(async () => {
    await result.current.reloadSpecs();
  });
  listSpecs.mockResolvedValue({ specs: [] });
  await act(async () => {
    await result.current.archiveSpec("phase-1-viewer");
  });

  expect(archiveSpec).toHaveBeenCalledWith({
    workspacePath: "/workspace/spec-reviewer",
    specId: "phase-1-viewer",
  });
  expect(result.current.specTreeState.status).toBe("empty");
  expect(result.current.selectedSpecId).toBeNull();
  result.unmount();
});
