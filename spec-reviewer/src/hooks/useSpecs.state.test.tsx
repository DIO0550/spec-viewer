import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";

import type { SpecDocument, SpecTree } from "../types/spec";
import { useSpecs } from "./useSpecs";

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

const designDocument: SpecDocument = {
  key: "design",
  path: "/workspace/spec-reviewer/.plugin-workspace/specs/phase-child/design.md",
  contents: "# Design",
  missing: false,
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

  expect(result.current.documentState).toEqual({
    status: "ready",
    workspacePath: "/workspace/spec-reviewer",
    specId: "phase-1-viewer",
    fileKey: "tasks",
    document: loadedDocument,
    error: null,
  });
  expect(readSpecFile).toHaveBeenCalledWith({
    workspacePath: "/workspace/spec-reviewer",
    specId: "phase-1-viewer",
    fileKey: "tasks",
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

  expect(result.current.documentState).toEqual({
    status: "missing",
    workspacePath: "/workspace/spec-reviewer",
    specId: "phase-1-viewer",
    fileKey: "impl",
    document: missingDocument,
    error: null,
  });
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
  expect(result.current.documentState).toEqual({
    status: "ready",
    workspacePath: "/workspace/spec-reviewer",
    specId: "phase-child",
    fileKey: "design",
    document: designDocument,
    error: null,
  });
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
